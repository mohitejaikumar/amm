use anchor_lang::prelude::*;

declare_id!("EmZ1g5YExu2DiZzdwKwEp1ypNnjxjTdYgNZVf6tmpaNm");

#[program]
pub mod amm_contract {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
