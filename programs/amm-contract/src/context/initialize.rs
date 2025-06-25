use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer, Mint, Token, TokenAccount, Transfer},
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
        seeds=[b"config", seed.to_le_bytes().as_ref()],
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
        seed: u64,
        fees: u16,
        authority: Optional<Pubkey>,
        bumps: InitializeConfigBumps,
    ) -> Result<()> {
        self.config.set_inner(Config {
            seed,
            authority,
            fees,
            mint_x,
            mint_y,
            my_bump: bumps.config,
            lp_bump: bumps.mint_lp,
        });

        Ok(())
    }
}
