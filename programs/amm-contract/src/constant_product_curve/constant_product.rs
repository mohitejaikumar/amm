pub struct XYAmounts {
    x: u64,
    y: u64,
}

pub struct ConstantProductCurve {}

#[error_code]
pub enum CurveError {
    #[msg("Overflow")]
    CurveOverflow,
}

impl ConstantProductCurve {
    pub fn give_lp_take_xy(
        total_x: u64,
        total_y: u64,
        total_lp: u64,
        lp_required: u64,
        precision: u32,
    ) -> Result<XYAmounts, CurveError> {
        let ratio = (total_lp as u128)
            .checked_add(lp_required as u128)
            .ok_or(CurveError::Overflow)?
            .checked_mul(precision as u128)
            .ok_or(CurveError::Overflow)?
            .checked_div(lp_required as u128)
            .ok_or(CurveError::Overflow)?;

        let deposit_x = (total_x as u128)
            .checked_mul(ratio as u128)
            .ok_or(CurveError::Overflow)?
            .checked_div(precision as u128)
            .ok_or(CurveError::Overflow)?
            .checked_sub(total_x as u128)
            .ok_or(CurveError::Overflow)? as u64;

        let deposit_y = (total_y as u128)
            .checked_mul(ratio as u128)
            .ok_or(CurveError::Overflow)?
            .checked_div(precision as u128)
            .ok_or(CurveError::Overflow)?
            .checked_sub(total_y as u128)
            .ok_or(CurveError::Overflow)? as u64;

        Ok(XYAmounts {
            x: deposit_x,
            y: deposit_y,
        })
    }
}
