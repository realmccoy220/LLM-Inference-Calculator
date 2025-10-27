
import { QuantizationType } from './types';

export const QUANTIZATION_FACTORS: Record<QuantizationType, number> = {
  [QuantizationType.INT4]: 0.5,
  [QuantizationType.INT8_FP8]: 1,
  [QuantizationType.FP16]: 2,
  [QuantizationType.FP32]: 4,
};

export const OVERHEAD_FACTOR = 1.2;

export const HOURS_IN_MONTH = 730;
