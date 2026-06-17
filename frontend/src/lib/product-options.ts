/** Shared product option types (mirrors backend Product schema). */

export interface ProductReview {
  id?: string;
  author: string;
  quote: string;
  rating: number;
  avatarUrl?: string;
}

export interface ProductEmailFlowStep {
  id?: string;
  dayOffset: number;
  subject: string;
  body: string;
  enabled: boolean;
}

export interface ProductDiscountCode {
  id?: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
}

export interface ProductCustomField {
  id?: string;
  label: string;
  type: 'text' | 'textarea' | 'phone';
  required: boolean;
}

export interface ProductOrderBump {
  enabled: boolean;
  title: string;
  description: string;
  priceCents: number;
}

export interface ProductAffiliate {
  enabled: boolean;
  commissionPercent: number;
}

export interface ProductPaymentPlan {
  enabled: boolean;
  installments: number;
}

export interface ProductReviewsConfig {
  enabled: boolean;
  items: ProductReview[];
}

export const DEFAULT_CONFIRM_SUBJECT = 'Your [Product Name] download from @[My Username]!';
export const DEFAULT_CONFIRM_BODY =
  'Hi [Customer Name]!\n\nHere is your download for:\n[Product File(s)]\n\n- @[My Username]';

/** Tokens offered by the "Personalize" menu in email editors. */
export const PERSONALIZE_TOKENS = [
  '[Customer Name]',
  '[Product Name]',
  '[Product File(s)]',
  '@[My Username]',
] as const;

export const EMPTY_ORDER_BUMP: ProductOrderBump = {
  enabled: false,
  title: '',
  description: '',
  priceCents: 0,
};

export const EMPTY_AFFILIATE: ProductAffiliate = {
  enabled: false,
  commissionPercent: 20,
};

export const EMPTY_PAYMENT_PLAN: ProductPaymentPlan = {
  enabled: false,
  installments: 3,
};

export const EMPTY_REVIEWS: ProductReviewsConfig = {
  enabled: false,
  items: [],
};

export function defaultEmailFlowSteps(): ProductEmailFlowStep[] {
  return [
    {
      dayOffset: 1,
      subject: 'Quick check-in',
      body: 'Hey! Just wanted to see how you\'re getting on with your purchase. Reply if you have any questions.',
      enabled: true,
    },
  ];
}

export function generateDescriptionFromTitle(title: string, kind: string): string {
  const name = title.trim() || 'this product';
  if (kind === 'custom') {
    return `I will personally review your request and help you build a plan for success.\n\nBy purchasing this product, I will create a custom video/ product just for you where I address your unique request and give you my best recommendations!\n\n**This is for you if you're looking to:**\n• Have your unique request reviewed\n• Looking for direction that is specific to you\n• Need guidance but not ready for a 1:1 session`;
  }
  if (kind === 'membership') {
    return `Want weekly access to me to help you reach your goals?\n\n**Join my monthly membership and you will get:**\n• Exclusive Access to our Group Chat\n• Weekly Calls with Me\n• Daily Tips on How to Succeed`;
  }
  const bullets =
    kind === 'lead_magnet'
      ? '• Get instant access to the guide\n• Join the email list for updates\n• Start applying tips today'
      : '• Achieve your goals faster\n• Learn proven strategies\n• Get lifetime access';
  return `${name} gives you everything you need to succeed.\n\nThis is for you if you want to:\n${bullets}`;
}
