use crate::states::Config;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{transfer_checked, Mint, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"config", mint_x.key().as_ref(), mint_y.key().as_ref()],
        bump = config.my_bump,
        has_one = mint_x,
        has_one = mint_y
    )]
    pub config: Account<'info, Config>,

    pub mint_x: InterfaceAccount<'info, Mint>,
    pub mint_y: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = config
    )]
    pub vault_x: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = config
    )]
    pub vault_y: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = user
    )]
    pub user_x: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = user
    )]
    pub user_y: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Swap<'info> {
    pub fn swap(
        &mut self,
        amount_in: u64,
        min_out: u64, // for Slippage control
        is_x_in: bool,
    ) -> Result<()> {
        // transfer the amount from user ATA to vault
        // get the amount_will_get , after deducting the fees
        // it should be grater than eqault to min_out
        // transfer from vault to the USER ATA

        if is_x_in {
            self.transfer_in(&self.user_x, &self.vault_x, &self.mint_x, amount_in)?;
        } else {
            self.transfer_in(&self.user_y, &self.vault_y, &self.mint_y, amount_in)?;
        }

        let fees = self.config.fees as u128;
        let amount_in_u128 = amount_in as u128;
        // fees = 20 -> 0.2 (actual_fees)
        let amount_in_after_fee = amount_in_u128
            .checked_mul(10_000 - fees)
            .ok_or(ErrorCode::Mathoverflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Mathoverflow)?;

        let (x_bal, y_bal) = (self.vault_x.amount as u128, self.vault_y.amount as u128);
        let k = x_bal.checked_mul(y_bal).ok_or(ErrorCode::Mathoverflow)?;

        let (mut in_bal, mut out_bal) = (x_bal, y_bal);

        if !is_x_in {
            core::mem::swap(&mut in_bal, &mut out_bal);
        }

        let new_in = in_bal
            .checked_add(amount_in_after_fee)
            .ok_or(ErrorCode::Mathoverflow)?;
        let new_out = k.checked_div(new_in).ok_or(ErrorCode::Mathoverflow)?;
        let out_amt = out_bal
            .checked_sub(new_out)
            .ok_or(ErrorCode::Mathoverflow)?;

        require!(out_amt as u64 >= min_out, ErrorCode::SlippageTooHigh);

        let out_u64 = out_amt as u64;
        if is_x_in {
            self.transfer_out(&self.vault_y, &self.user_y, &self.mint_y, out_u64)?;
        } else {
            self.transfer_out(&self.vault_x, &self.user_x, &self.mint_x, out_u64)?;
        }

        Ok(())
    }

    pub fn transfer_in(
        &self,
        from: &InterfaceAccount<'info, TokenAccount>,
        to: &InterfaceAccount<'info, TokenAccount>,
        mint: &InterfaceAccount<'info, Mint>,
        amount: u64,
    ) -> Result<()> {
        let cpi_context = CpiContext::new(
            self.token_program.to_account_info(),
            TransferChecked {
                from: from.to_account_info(),
                to: to.to_account_info(),
                mint: mint.to_account_info(),
                authority: self.user.to_account_info(),
            },
        );

        transfer_checked(cpi_context, amount, mint.decimals)
    }

    pub fn transfer_out(
        &self,
        from: &InterfaceAccount<'info, TokenAccount>,
        to: &InterfaceAccount<'info, TokenAccount>,
        mint: &InterfaceAccount<'info, Mint>,
        amount: u64,
    ) -> Result<()> {
        let bump_byte = self.config.my_bump;

        let mint_x_key = self.mint_x.key();
        let mint_x_pubkey = mint_x_key.as_ref();
        let mint_y_key = self.mint_y.key();
        let mint_y_pubkey = mint_y_key.as_ref();

        let seeds = &[b"config", mint_x_pubkey, mint_y_pubkey, &[bump_byte]];

        let signer_seeds = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from: from.to_account_info(),
                to: to.to_account_info(),
                mint: mint.to_account_info(),
                authority: self.config.to_account_info(),
            },
            signer_seeds,
        );

        transfer_checked(cpi_context, amount, mint.decimals)
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    Mathoverflow,
    #[msg("Slippage too high")]
    SlippageTooHigh,
}
