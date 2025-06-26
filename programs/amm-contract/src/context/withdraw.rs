use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Token;
use anchor_spl::token_interface::{
    burn_checked, transfer_checked, BurnChecked, Mint, TokenAccount, TransferChecked,
};

use crate::constant_product_curve::ConstantProductCurve;
use crate::states::Config;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub mint_x: InterfaceAccount<'info, Mint>,
    pub mint_y: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"lp", config.key().as_ref()],
        bump = config.lp_bump,
        mint::decimals = 6,
        mint::authority = config
    )]
    pub mint_lp: InterfaceAccount<'info, Mint>,

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
        init_if_needed,
        payer = user,
        associated_token::mint = mint_x,
        associated_token::authority = user,
    )]
    pub user_x: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint_y,
        associated_token::authority = user,
    )]
    pub user_y: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed, // Maybe this user has good lp token transfered
        payer = user,
        associated_token::mint = mint_lp,
        associated_token::authority = user
    )]
    pub user_lp: InterfaceAccount<'info, TokenAccount>,

    #[account(
        has_one = mint_x,
        has_one = mint_y,
        seeds = [b"config", mint_x.key().as_ref(), mint_y.key().as_ref()],
        bump = config.my_bump
    )]
    pub config: Account<'info, Config>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, min_x: u64, min_y: u64, lp_amount: u64) -> Result<()> {
        // calculate amount_x, amount_y you get giving lp_amount
        // if that amount_x>=min_x and amount_y>=min_y (good to go)
        // Burn lp_amount of LP TOKENS
        // transfer amount_x of X tokens from vault_x to user_x
        // transfer amount_y of Y tokens from vault_y to user_y

        let (x, y) = match self.mint_lp.supply == 0
            && self.vault_x.amount == 0
            && self.vault_y.amount == 0
        {
            true => (min_x, min_y),
            false => {
                let amounts = ConstantProductCurve::take_lp_give_xy(
                    self.vault_x.amount,
                    self.vault_y.amount,
                    self.mint_lp.supply,
                    lp_amount,
                    6,
                )
                .unwrap();

                (amounts.x, amounts.y)
            }
        };

        require!(x >= min_x && y >= min_y, ErrorCode::InsufficientBalance);
        self.withdraw_token(true, x)?;
        self.withdraw_token(false, y)?;
        self.burn_lp_token(lp_amount)
    }

    fn withdraw_token(&mut self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to, mint, decimals) = match is_x {
            true => (
                self.vault_x.to_account_info(),
                self.user_x.to_account_info(),
                self.mint_x.to_account_info(),
                self.mint_x.decimals,
            ),
            false => (
                self.vault_y.to_account_info(),
                self.user_y.to_account_info(),
                self.mint_y.to_account_info(),
                self.mint_y.decimals,
            ),
        };

        let mint_x_key = self.mint_x.key();
        let mint_x_pubkey = mint_x_key.as_ref();
        let mint_y_key = self.mint_y.key();
        let mint_y_pubkey = mint_y_key.as_ref();

        let seeds = &[
            b"config",
            mint_x_pubkey,
            mint_y_pubkey,
            &[self.config.my_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from,
                to,
                mint: mint,
                authority: self.config.to_account_info(),
            },
            signer_seeds,
        );

        transfer_checked(cpi_context, amount, decimals)
    }

    fn burn_lp_token(&mut self, amount: u64) -> Result<()> {
        let cpi_context = CpiContext::new(
            self.token_program.to_account_info(),
            BurnChecked {
                mint: self.mint_lp.to_account_info(),
                from: self.user_lp.to_account_info(),
                authority: self.user.to_account_info(),
            },
        );

        burn_checked(cpi_context, amount, self.mint_lp.decimals)
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("InsufficientBalance")]
    InsufficientBalance,
}
