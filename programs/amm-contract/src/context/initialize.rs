use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{Mint, TokenAccount},
};

use crate::states::Config;

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    pub mint_x: InterfaceAccount<'info, Mint>,
    pub mint_y: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer=initializer,
        seeds=[b"lp", config.key().as_ref()],
        mint::authority = config,
        mint::decimals = 6,
        bump
    )]
    pub mint_lp: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer=initializer,
        associated_token::mint = mint_x,
        associated_token::authority = config
    )]
    pub vault_x: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer=initializer,
        associated_token::mint = mint_y,
        associated_token::authority = config
    )]
    pub vault_y: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer=initializer,
        seeds=[b"config", mint_x.key().as_ref(), mint_y.key().as_ref()],
        space= 8 + Config::INIT_SPACE,
        bump
    )]
    pub config: Account<'info, Config>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> InitializeConfig<'info> {
    pub fn init(
        &mut self,
        fees: u16,
        authority: Option<Pubkey>,
        bumps: InitializeConfigBumps,
    ) -> Result<()> {
        self.config.set_inner(Config {
            authority,
            fees,
            mint_x: self.mint_x.key(),
            mint_y: self.mint_y.key(),
            my_bump: bumps.config,
            lp_bump: bumps.mint_lp,
        });

        Ok(())
    }
}
