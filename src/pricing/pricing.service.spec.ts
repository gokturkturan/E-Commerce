import { ConfigService } from '@nestjs/config';
import { PricingService, roundMoney } from './pricing.service';

describe('PricingService', () => {
  const configWith = (values: Record<string, string> = {}) =>
    ({
      get: (key: string, fallback?: string) => values[key] ?? fallback,
    }) as unknown as ConfigService;

  const service = new PricingService(configWith());

  it('should charge the shipping fee below the free-shipping threshold', () => {
    expect(service.summarize(20)).toEqual({
      subtotal: 20,
      shippingFee: 4.99,
      total: 24.99,
      freeShippingThreshold: 50,
    });
  });

  it('should ship for free at or above the threshold', () => {
    expect(service.summarize(50).shippingFee).toBe(0);
    expect(service.summarize(120.5).total).toBe(120.5);
  });

  it('should not charge shipping for an empty cart', () => {
    expect(service.summarize(0)).toMatchObject({ shippingFee: 0, total: 0 });
  });

  it('should read the fee and threshold from configuration', () => {
    const custom = new PricingService(
      configWith({ SHIPPING_FEE: '6.5', FREE_SHIPPING_THRESHOLD: '100' }),
    );

    expect(custom.summarize(80)).toMatchObject({
      shippingFee: 6.5,
      total: 86.5,
      freeShippingThreshold: 100,
    });
  });

  it('should round sums to whole cents', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(service.summarize(19.99 * 3).subtotal).toBe(59.97);
  });
});
