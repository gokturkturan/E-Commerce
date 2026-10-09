import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PriceSummary {
  subtotal: number;
  shippingFee: number;
  total: number;
  freeShippingThreshold: number;
}

/** Rounds to whole cents so sums of decimals don't drift (e.g. 0.1 + 0.2). */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Single source of truth for shipping rules, shared by the cart summary and
 * order creation so the amount shown at checkout is the amount that is stored.
 */
@Injectable()
export class PricingService {
  private readonly shippingFee: number;
  private readonly freeShippingThreshold: number;

  constructor(config: ConfigService) {
    this.shippingFee = Number(config.get<string>('SHIPPING_FEE', '4.99'));
    this.freeShippingThreshold = Number(
      config.get<string>('FREE_SHIPPING_THRESHOLD', '50'),
    );
  }

  summarize(subtotal: number): PriceSummary {
    const roundedSubtotal = roundMoney(subtotal);
    const shippingFee =
      roundedSubtotal === 0 || roundedSubtotal >= this.freeShippingThreshold
        ? 0
        : this.shippingFee;

    return {
      subtotal: roundedSubtotal,
      shippingFee,
      total: roundMoney(roundedSubtotal + shippingFee),
      freeShippingThreshold: this.freeShippingThreshold,
    };
  }
}
