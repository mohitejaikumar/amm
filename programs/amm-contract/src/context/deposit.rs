use crate::constant_product_curve::ConstantProductCurve;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        mint_to, transfer_checked, Mint, MintTo, Token, TokenAccount, TransferChecked,
    },
};

use crate::states::Config;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub mint_x: InterfaceAccount<'info, Mint>,
    pub mint_y: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"lp", config.key().as_ref()]
        bump = config.lp_bump
    )]
    pub mint_lp: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::authority = config,
        associated_token::mint = mint_x
    )]
    pub vault_x: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::authority = config,
        associated_token::mint = mint_y
    )]
    pub vault_y: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::authority = user,
        associated_token::mint = mint_x
    )]
    pub user_x: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::authority = user,
        associated_token::mint = mint_y
    )]
    pub user_y: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::authority = user,
        associated_token::mint = mint_lp
    )]
    pub user_lp: InterfaceAccount<'info, TokenAccount>,

    #[account(
        has_one = mint_x,
        has_one = mint_y,
        seeds = [b"config", config.seed.to_le_bytes().as_ref()]
        bump = config.my_bump
    )]
    pub config: Account<'info, Config>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Deposit<'info> {
    // user want to deposite max_x qty of x tokens and max_y qty of y tokens in exchange of amount qty of lp tokens
    pub fn deposit(&mut self, amount: u64, max_x: u64, max_y: u64) -> Result<()> {
        // get actual amount of x and y they should deposite for return of `amount` lp
        // it should be less than equal to what they will deposite
        // deposite both token
        // transfer lp tokens to user
        assert!(amount > 0);

        let (x, y) = match self.mint_lp.supply == 0 && self.vault_x.amount == 0 {
            true => (max_x, max_y),
            false => {
                let amounts = ConstantProductCurve::give_lp_take_xy(
                    self.vault_x.amount,
                    self.vault_y.amount,
                    self.mint_lp.supply,
                    amount,
                    6,
                )
                .unwrap();

                (amounts.x, amounts.y)
            }
        };

        assert!(x <= max_x && y <= max_y);
        self.deposit_token(x, true)?;
        self.deposit_token(y, false)?;
        self.mint_lp_token(amount)?;

        Ok(())
    }

    pub fn deposit_token(&self, amount: u64, is_x: bool) -> Result<()> {
        let (from, to) = match is_x {
            true => (
                self.user_x.to_account_info(),
                self.vault_x.to_account_info(),
            ),
            false => (
                self.user_y.to_account_info(),
                self.vault_y.to_account_info(),
            ),
        };

        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            TransferChecked {
                from,
                to,
                authority: self.user.to_account_info(),
            },
        );

        transfer_checked(cpi_ctx, amount, 6)?;
        Ok(())
    }

    pub fn mint_lp_token(&self, amount: u64) -> Result<()> {
        let seeds = &[
            b"config",
            &self.config.seed.to_le_bytes(),
            &[self.config.my_bump],
        ];

        let signer_seeds = &[&[seeds[..]]];

        let cpi_context = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            MintTo {
                mint: self.mint_lp.to_account_info(),
                to: self.user_lp.to_account_info(),
                authority: self.config.to_account_info(),
            },
            signer_seeds,
        );

        mint_to(cpi_context, amount)?;
    }
}
