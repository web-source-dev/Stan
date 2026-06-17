import type { ProductEditorState } from '@/components/stan/ProductEditor';
import {
  DEFAULT_CONFIRM_BODY,
  DEFAULT_CONFIRM_SUBJECT,
  EMPTY_AFFILIATE,
  EMPTY_ORDER_BUMP,
  EMPTY_PAYMENT_PLAN,
  EMPTY_REVIEWS,
  defaultEmailFlowSteps,
} from '@/lib/product-options';

export type ProductKind =
  | 'lead_magnet'
  | 'digital'
  | 'custom'
  | 'membership';

/** How the "delivery" step behaves for a given kind. */
export type DeliveryKind =
  | 'file' // upload a downloadable file or redirect URL (digital, lead magnet)
  | 'access' // paste an external access link (community, membership)
  | 'manual'; // creator fulfils each order by hand (custom)

/** Middle tab in the 3-step product editor wizard. */
export type EditorMiddleTab = 'checkout' | 'product';

/** Optional panels on the Options tab — varies by product kind. */
export type EditorOptionPanel =
  | 'reviews'
  | 'email-flows'
  | 'order-bump'
  | 'affiliate'
  | 'confirmation';

export interface ProductKindMeta {
  kind: ProductKind;
  title: string;
  body: string;
  backendType: 'digital' | 'lead_magnet';
  /** Checkout-tab section toggles + labels, tuned per kind. */
  showPrice: boolean;
  showDiscount: boolean;
  showCollectInfo: boolean;
  recurring: boolean;
  priceLabel: string;
  priceSuffix: string;
  deliveryStep: DeliveryKind | 'none';
  deliveryLabel: string;
  deliveryHint: string;
  collectInfoLabel: string;
  /** Editor UI configuration (Stan reference layouts). */
  editorMiddleTab: EditorMiddleTab;
  editorMiddleTabLabel: string;
  showThumbnailStylePicker: boolean;
  collectInfoOnThumbnail: boolean;
  /** Which field the Thumbnail-tab "Button" input maps to. */
  thumbnailButtonField: 'ctaLabel' | 'bottomTitle' | 'thumbnailButtonLabel';
  /** Thumbnail style options shown in the picker (defaults to all three). */
  thumbnailStyles: ('button' | 'callout' | 'preview')[];
  /** Options-tab phone preview: description + bottom title only (no form/total). */
  optionsPreviewMinimal?: boolean;
  /** Options-tab phone preview: checkout content + form fields, no total/CTA. */
  optionsPreviewPartial?: boolean;
  /** Membership checkout: recurring interval + cancel-after controls. */
  membershipScheduling?: boolean;
  /** Pro-gated price features shown before unlock (defaults to all three). */
  lockedPriceFeatures?: string[];
  optionPanels: EditorOptionPanel[];
  productTabTitle?: string;
  /** Show order total + PURCHASE in phone preview (digital checkout/options). */
  showPaidCheckoutPreview?: boolean;
  defaults: Partial<ProductEditorState>;
}

export const PRODUCT_KINDS: ProductKindMeta[] = [
  {
    kind: 'lead_magnet',
    title: 'Collect Emails / Applications',
    body: "Collect your audience's info with a lead magnet.",
    backendType: 'lead_magnet',
    showPrice: false,
    showDiscount: false,
    showCollectInfo: true,
    recurring: false,
    priceLabel: 'Price($)',
    priceSuffix: '',
    deliveryStep: 'file',
    deliveryLabel: 'Upload your free resource',
    deliveryHint: 'Stan will email this file automatically after someone signs up.',
    collectInfoLabel: 'Collect info',
    editorMiddleTab: 'product',
    editorMiddleTabLabel: 'Product',
    showThumbnailStylePicker: false,
    collectInfoOnThumbnail: true,
    thumbnailButtonField: 'ctaLabel',
    thumbnailStyles: ['button', 'callout', 'preview'],
    optionPanels: ['email-flows', 'confirmation'],
    productTabTitle: 'Upload Attachment & Files',
    defaults: {
      type: 'lead_magnet',
      productKind: 'lead_magnet',
      title: 'Get My FREE Guide Now!',
      shortDescription: 'Join my email list and never miss an update from me!',
      bottomTitle: 'Get My FREE Guide',
      ctaLabel: 'SUBMIT & DOWNLOAD',
      thumbnailStyle: 'callout',
      priceDollars: '',
    },
  },
  {
    kind: 'digital',
    title: 'Digital Product',
    body: 'PDFs, guides, templates, exclusive content, eBooks, etc.',
    backendType: 'digital',
    showPrice: true,
    showDiscount: true,
    showCollectInfo: true,
    recurring: false,
    priceLabel: 'Price($)',
    priceSuffix: '',
    deliveryStep: 'file',
    deliveryLabel: 'Upload your Digital Product',
    deliveryHint: 'Stan will send these files automatically to your customer upon purchase!',
    collectInfoLabel: 'Collect info',
    editorMiddleTab: 'checkout',
    editorMiddleTabLabel: 'Checkout Page',
    showThumbnailStylePicker: true,
    collectInfoOnThumbnail: false,
    thumbnailButtonField: 'bottomTitle',
    thumbnailStyles: ['button', 'callout', 'preview'],
    optionPanels: ['reviews', 'email-flows', 'order-bump', 'affiliate', 'confirmation'],
    showPaidCheckoutPreview: true,
    defaults: {
      type: 'digital',
      productKind: 'digital',
      title: 'Get My [Template/eBook/Course] Now!',
      shortDescription: 'We will deliver this file right to your inbox',
      description:
        "This [Template/eBook/Course] will teach you everything you need to achieve your goals.\n\n**This guide is for you if you're looking to:**\n• Achieve your Dream\n• Find Meaning in Your Work\n• Be Happy",
      bottomTitle: 'Get My Guide',
      ctaLabel: 'PURCHASE',
      thumbnailStyle: 'callout',
      priceDollars: '9.99',
    },
  },
  {
    kind: 'custom',
    title: 'Custom Product',
    body: '"Ask Me Anything" requests, audits / analyses, video reviews.',
    backendType: 'digital',
    showPrice: true,
    showDiscount: false,
    showCollectInfo: true,
    recurring: false,
    priceLabel: 'Price($)',
    priceSuffix: '',
    deliveryStep: 'none',
    deliveryLabel: 'Delivery details',
    deliveryHint: "You'll fulfil each order by hand — tell buyers what they get and how long it takes.",
    collectInfoLabel: 'Collect info',
    editorMiddleTab: 'checkout',
    editorMiddleTabLabel: 'Checkout Page',
    showThumbnailStylePicker: true,
    collectInfoOnThumbnail: false,
    thumbnailButtonField: 'thumbnailButtonLabel',
    thumbnailStyles: ['button', 'callout'],
    optionsPreviewMinimal: true,
    optionPanels: ['reviews', 'email-flows', 'order-bump', 'affiliate', 'confirmation'],
    showPaidCheckoutPreview: true,
    defaults: {
      type: 'digital',
      productKind: 'custom',
      title: 'Personalized Video Response',
      shortDescription: "I'll send you a custom video/product addressing your unique request!",
      description:
        'I will personally review your request and help you build a plan for success.\n\nBy purchasing this product, I will create a custom video/ product just for you where I address your unique request and give you my best recommendations!\n\n**This is for you if you\'re looking to:**\n• Have your unique request reviewed\n• Looking for direction that is specific to you\n• Need guidance but not ready for a 1:1 session',
      bottomTitle: 'Get Your Video!',
      ctaLabel: 'PURCHASE',
      thumbnailButtonLabel: 'Submit Your Request',
      thumbnailStyle: 'callout',
      priceDollars: '9.99',
    },
  },
  {
    kind: 'membership',
    title: 'Recurring Membership',
    body: 'Charge recurring subscriptions for ongoing access.',
    backendType: 'digital',
    showPrice: true,
    showDiscount: true,
    showCollectInfo: true,
    recurring: true,
    priceLabel: 'Price($)',
    priceSuffix: '/mo',
    deliveryStep: 'none',
    deliveryLabel: 'Member access link',
    deliveryHint: 'Where members go after subscribing (private content, Circle, Discord, etc.).',
    collectInfoLabel: 'Collect info',
    editorMiddleTab: 'checkout',
    editorMiddleTabLabel: 'Checkout Page',
    showThumbnailStylePicker: true,
    collectInfoOnThumbnail: false,
    thumbnailButtonField: 'thumbnailButtonLabel',
    thumbnailStyles: ['button', 'callout'],
    membershipScheduling: true,
    optionsPreviewPartial: true,
    lockedPriceFeatures: ['Add Discount Code', 'Limit Quantity'],
    optionPanels: ['reviews', 'email-flows', 'order-bump', 'affiliate', 'confirmation'],
    showPaidCheckoutPreview: true,
    defaults: {
      type: 'digital',
      productKind: 'membership',
      title: 'Join My Membership',
      shortDescription: 'Get exclusive how-to tips, weekly check ins and live webinar with me!',
      description:
        'Want weekly access to me to help you reach your goals?\n\n**Join my monthly membership and you will get:**\n• Exclusive Access to our Group Chat\n• Weekly Calls with Me\n• Daily Tips on How to Succeed',
      bottomTitle: 'Join My Membership!',
      ctaLabel: 'JOIN NOW',
      thumbnailButtonLabel: 'Join My Membership',
      thumbnailStyle: 'callout',
      priceDollars: '9.99',
      billingInterval: 'month',
    },
  },
];

export function getProductKindMeta(kind: string | null | undefined): ProductKindMeta {
  return PRODUCT_KINDS.find((k) => k.kind === kind) ?? PRODUCT_KINDS[1];
}

export function buildInitialProduct(kind: string | null | undefined): ProductEditorState {
  const meta = getProductKindMeta(kind);
  return {
    title: '',
    priceDollars: '',
    type: meta.backendType,
    productKind: meta.kind,
    shortDescription: '',
    description: '',
    bottomTitle: '',
    ctaLabel: '',
    thankYouMessage: '',
    coverImageUrl: '',
    coverPublicId: '',
    assets: [],
    deliveryMode: 'file',
    redirectUrl: '',
    thumbnailStyle: 'callout',
    discountPriceDollars: '',
    discountEnabled: false,
    thumbnailButtonLabel: '',
    billingInterval: 'one_time',
    cancelSubscriptionEnabled: false,
    cancelAfterMonths: '0',
    fulfilmentNote: '',
    accessUrl: '',
    confirmSubject: DEFAULT_CONFIRM_SUBJECT,
    confirmBody: DEFAULT_CONFIRM_BODY,
    reviews: { ...EMPTY_REVIEWS },
    emailFlows: defaultEmailFlowSteps().map((s, i) => ({ ...s, id: `step_${i}` })),
    orderBump: { ...EMPTY_ORDER_BUMP },
    affiliate: { ...EMPTY_AFFILIATE },
    paymentPlan: { ...EMPTY_PAYMENT_PLAN },
    discountCodes: [],
    quantityLimit: '',
    customFields: [],
    showPaymentPlan: false,
    showDiscountCodes: false,
    showQuantityLimit: false,
    ...meta.defaults,
  };
}
