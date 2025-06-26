use anchor_lang::prelude::*;

pub struct XYAmounts {
    pub x: u64,
    pub y: u64,
}

pub struct ConstantProductCurve {}

#[error_code]
pub enum CurveError {
    #[msg("Overflow")]
    Overflow,
    #[msg("Invalid Precision")]
    InvalidPrecision,
}

impl ConstantProductCurve {
    pub fn give_lp_take_xy(
        total_x: u64,
        total_y: u64,
        total_lp: u64,
        lp_required: u64,
        precision: u32,
    ) -> Result<XYAmounts> {
        let scaling_factor = 10u32
            .checked_pow(precision as u32)
            .ok_or(CurveError::InvalidPrecision)?;
        let ratio = (total_lp as u128)
            .checked_add(lp_required as u128)
            .ok_or(CurveError::Overflow)?
            .checked_mul(scaling_factor as u128)
            .ok_or(CurveError::Overflow)?
            .checked_div(total_lp as u128)
            .ok_or(CurveError::Overflow)?;

        let deposit_x = (total_x as u128)
            .checked_mul(ratio as u128)
            .ok_or(CurveError::Overflow)?
            .checked_div(scaling_factor as u128)
            .ok_or(CurveError::Overflow)?
            .checked_sub(total_x as u128)
            .ok_or(CurveError::Overflow)? as u64;

        let deposit_y = (total_y as u128)
            .checked_mul(ratio as u128)
            .ok_or(CurveError::Overflow)?
            .checked_div(scaling_factor as u128)
            .ok_or(CurveError::Overflow)?
            .checked_sub(total_y as u128)
            .ok_or(CurveError::Overflow)? as u64;

        Ok(XYAmounts {
            x: deposit_x,
            y: deposit_y,
        })
    }

    pub fn take_lp_give_xy(
        total_x: u64,
        total_y: u64,
        total_lp: u64,
        lp_give: u64,
        precision: u32,
    ) -> Result<XYAmounts> {
        let scaling_factor = 10u32
            .checked_pow(precision as u32)
            .ok_or(CurveError::InvalidPrecision)?;
        let ratio = ((total_lp - lp_give) as u128)
            .checked_mul(scaling_factor as u128)
            .ok_or(CurveError::Overflow)?
            .checked_div(total_lp as u128)
            .ok_or(CurveError::Overflow)?;

        let withdraw_x = (total_x as u128)
            .checked_sub(
                (total_x as u128)
                    .checked_mul(ratio)
                    .ok_or(CurveError::Overflow)?
                    .checked_div(precision as u128)
                    .ok_or(CurveError::Overflow)?,
            )
            .ok_or(CurveError::Overflow)? as u64;

        let withdraw_y = (total_y as u128)
            .checked_sub(
                (total_y as u128)
                    .checked_mul(ratio)
                    .ok_or(CurveError::Overflow)?
                    .checked_div(precision as u128)
                    .ok_or(CurveError::Overflow)?,
            )
            .ok_or(CurveError::Overflow)? as u64;

        Ok(XYAmounts {
            x: withdraw_x,
            y: withdraw_y,
        })
    }
}
