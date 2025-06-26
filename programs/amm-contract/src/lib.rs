use anchor_lang::prelude::*;

mod constant_product_curve;
mod context;
mod states;

use context::*;

declare_id!("EmZ1g5YExu2DiZzdwKwEp1ypNnjxjTdYgNZVf6tmpaNm");

#[program]
pub mod amm_contract {
    use super::*;

    pub fn initialize(
        ctx: Context<InitializeConfig>,
        fees: u16,
        authority: Option<Pubkey>,
    ) -> Result<()> {
        ctx.accounts.init(fees, authority, ctx.bumps)?;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount_lp: u64, max_x: u64, max_y: u64) -> Result<()> {
        ctx.accounts.deposit(amount_lp, max_x, max_y)?;
        Ok(())
    }

    pub fn swap(ctx: Context<Swap>, amount_in: u64, min_out: u64, is_x_in: bool) -> Result<()> {
        ctx.accounts.swap(amount_in, min_out, is_x_in)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, min_x: u64, min_y: u64, lp_amount: u64) -> Result<()> {
        ctx.accounts.withdraw(min_x, min_y, lp_amount)?;
        Ok(())
    }
}
