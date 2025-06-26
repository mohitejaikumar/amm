use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub mint_x: Pubkey,
    pub mint_y: Pubkey,
    pub fees: u16,
    pub my_bump: u8,
    pub lp_bump: u8,
    pub authority: Option<Pubkey>,
}
