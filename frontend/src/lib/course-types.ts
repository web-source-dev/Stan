import {
  DEFAULT_CONFIRM_BODY,
  DEFAULT_CONFIRM_SUBJECT,
  defaultEmailFlowSteps,
  type ProductCustomField,
  type ProductEmailFlowStep,
} from '@/lib/product-options';

export interface CourseModuleLesson {
  id: string;
  title: string;
  type: string;
  preview: boolean;
  status: string;
  sortOrder: number;
  durationSec?: number;
  textContent?: string;
  assetFilename?: string;
  hasVideo?: boolean;
  hasAsset?: boolean;
}

export interface CourseModule {
  id: string;
  title: string;
  sortOrder: number;
  status: string;
  lessons: CourseModuleLesson[];
}

export interface CourseEditorState {
  id?: string;
  title: string;
  shortDescription: string;
  description: string;
  bottomTitle: string;
  ctaLabel: string;
  thumbnailButtonLabel: string;
  coverImageUrl: string;
  coverPublicId: string;
  thumbnailStyle: 'button' | 'callout' | 'preview';
  priceDollars: string;
  discountPriceDollars: string;
  discountEnabled: boolean;
  billingInterval: 'one_time' | 'month' | 'year';
  homepageTitle: string;
  homepageDescription: string;
  homepageCoverImageUrl: string;
  homepageCoverPublicId: string;
  titleFont: string;
  backgroundColor: string;
  highlightColor: string;
  customFields: ProductCustomField[];
  emailFlows: ProductEmailFlowStep[];
  confirmSubject: string;
  confirmBody: string;
  modules: CourseModule[];
}

export const COURSE_TITLE_FONTS = [
  'Plus Jakarta Sans',
  'Inter',
  'DM Sans',
  'Poppins',
  'Montserrat',
];

export const COURSE_BG_PRESETS = ['#f3f6fd', '#fef3f2', '#f0fdf4', '#fffbeb', '#faf5ff', '#f8fafc'];
export const COURSE_ACCENT_PRESETS = ['#6355FF', '#111827', '#ea580c', '#e11d48', '#2563eb', '#0d9488'];

export const DEFAULT_HOMEPAGE_DESCRIPTION =
  "In this section, you're convincing your potential student to take the leap and purchase your course.\n\n**This is for you if you're looking to:**\n• List what they will learn\n• List what they will learn\n• List what they will learn\n• List what they will learn";

export function generateCourseDescription(): string {
  return DEFAULT_HOMEPAGE_DESCRIPTION;
}

export function buildInitialCourse(): CourseEditorState {
  return {
    title: 'Get started with this amazing course',
    shortDescription: 'A 2-line course summary to close the sale. What will they learn?',
    description: generateCourseDescription(),
    bottomTitle: 'Get My Course',
    ctaLabel: 'PURCHASE',
    thumbnailButtonLabel: 'GET MY COURSE',
    coverImageUrl: '',
    coverPublicId: '',
    thumbnailStyle: 'callout',
    priceDollars: '9.99',
    discountPriceDollars: '',
    discountEnabled: false,
    billingInterval: 'one_time',
    homepageTitle: 'My 12-week Program',
    homepageDescription: DEFAULT_HOMEPAGE_DESCRIPTION,
    homepageCoverImageUrl: '',
    homepageCoverPublicId: '',
    titleFont: 'Plus Jakarta Sans',
    backgroundColor: '#f3f6fd',
    highlightColor: '#6355FF',
    customFields: [],
    emailFlows: defaultEmailFlowSteps().map((s, i) => ({ ...s, id: `step_${i}` })),
    confirmSubject: DEFAULT_CONFIRM_SUBJECT,
    confirmBody: DEFAULT_CONFIRM_BODY,
    modules: [],
  };
}

export type ApiCourse = {
  id: string;
  title: string;
  shortDescription?: string;
  description?: string;
  priceCents: number;
  discountPriceCents?: number;
  discountEnabled?: boolean;
  billingInterval?: 'one_time' | 'month' | 'year';
  coverImageUrl?: string;
  coverPublicId?: string;
  thumbnailStyle?: 'button' | 'callout' | 'preview';
  thumbnailButtonLabel?: string;
  bottomTitle?: string;
  ctaLabel?: string;
  homepageTitle?: string;
  homepageDescription?: string;
  homepageCoverImageUrl?: string;
  homepageCoverPublicId?: string;
  titleFont?: string;
  backgroundColor?: string;
  highlightColor?: string;
  confirmSubject?: string;
  confirmBody?: string;
};

export function courseFromApi(
  course: ApiCourse,
  modules: CourseModule[] = [],
): CourseEditorState {
  return {
    id: course.id,
    title: course.title,
    shortDescription: course.shortDescription ?? '',
    description: course.description ?? '',
    bottomTitle: course.bottomTitle ?? 'Get My Course',
    ctaLabel: course.ctaLabel ?? 'PURCHASE',
    thumbnailButtonLabel: course.thumbnailButtonLabel ?? 'GET MY COURSE',
    coverImageUrl: course.coverImageUrl ?? '',
    coverPublicId: course.coverPublicId ?? '',
    thumbnailStyle: course.thumbnailStyle ?? 'callout',
    priceDollars: (course.priceCents / 100).toString(),
    discountPriceDollars: course.discountPriceCents ? (course.discountPriceCents / 100).toString() : '',
    discountEnabled: Boolean(course.discountEnabled && course.discountPriceCents),
    billingInterval: course.billingInterval ?? 'one_time',
    homepageTitle: course.homepageTitle ?? course.title,
    homepageDescription: course.homepageDescription ?? DEFAULT_HOMEPAGE_DESCRIPTION,
    homepageCoverImageUrl: course.homepageCoverImageUrl ?? course.coverImageUrl ?? '',
    homepageCoverPublicId: course.homepageCoverPublicId ?? '',
    titleFont: course.titleFont ?? 'Plus Jakarta Sans',
    backgroundColor: course.backgroundColor ?? '#f3f6fd',
    highlightColor: course.highlightColor ?? '#6355FF',
    customFields: [],
    emailFlows: defaultEmailFlowSteps().map((s, i) => ({ ...s, id: `step_${i}` })),
    confirmSubject: course.confirmSubject || DEFAULT_CONFIRM_SUBJECT,
    confirmBody: course.confirmBody || DEFAULT_CONFIRM_BODY,
    modules,
  };
}
