import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { creatorRouter } from '../modules/creator/creator.routes';
import { storefrontRouter } from '../modules/storefront/storefront.routes';
import { cloudinaryRouter } from '../modules/cloudinary/cloudinary.routes';
import { mediaRouter } from '../modules/media/media.routes';
import { adminRouter } from '../modules/admin/admin.routes';
import { connectRouter } from '../modules/payments/connect.routes';
import { productsRouter } from '../modules/products/products.routes';
import { checkoutRouter } from '../modules/checkout/checkout.routes';
import { fulfilmentRouter } from '../modules/fulfilment/fulfilment.routes';
import { ordersRouter } from '../modules/orders/orders.routes';
import { leadsRouter } from '../modules/leads/leads.routes';
import { analyticsRouter } from '../modules/analytics/analytics.routes';
import { broadcastsRouter } from '../modules/broadcasts/broadcasts.routes';
import { coursesRouter } from '../modules/courses/courses.routes';
import { webinarsRouter } from '../modules/webinars/webinars.routes';
import { webinarRegistrationsRouter } from '../modules/webinars/webinar-registrations.routes';
import { learnRouter } from '../modules/learn/learn.routes';
import { bookingTypesRouter, bookingsRouter } from '../modules/bookings/bookings.routes';
import { referralsRouter } from '../modules/referrals/referrals.routes';
import { affiliatesRouter } from '../modules/affiliates/affiliates.routes';
import { flowsRouter } from '../modules/flows/flows.routes';
import { autodmRouter } from '../modules/autodm/autodm.routes';
import { landingRouter } from '../modules/landing/landing.routes';
import { subscriptionRouter } from '../modules/subscription/subscription.routes';
import { accountRouter } from '../modules/account/account.routes';
import { integrationsRouter } from '../modules/integrations/integrations.routes';
import { instagramPublicRouter } from '../modules/integrations/instagram.public.routes';
import { assistantRouter } from '../modules/assistant/assistant.routes';
import { portalRouter } from '../modules/portal/portal.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/creator', creatorRouter);
apiRouter.use('/storefront', storefrontRouter);
apiRouter.use('/cloudinary', cloudinaryRouter);
apiRouter.use('/media', mediaRouter);
apiRouter.use('/admin', adminRouter);

// Commerce phase
apiRouter.use('/payments/connect', connectRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/checkout', checkoutRouter);
apiRouter.use('/fulfilment', fulfilmentRouter);
apiRouter.use('/orders', ordersRouter);

// Growth phase
apiRouter.use('/leads', leadsRouter);
apiRouter.use('/events', analyticsRouter);
apiRouter.use('/broadcasts', broadcastsRouter);

// Learning & service phase
apiRouter.use('/courses', coursesRouter);
apiRouter.use('/webinars', webinarsRouter);
apiRouter.use('/webinar-registrations', webinarRegistrationsRouter);
apiRouter.use('/learn', learnRouter);
apiRouter.use('/booking-types', bookingTypesRouter);
apiRouter.use('/bookings', bookingsRouter);

// Growth & monetization modules
apiRouter.use('/referrals', referralsRouter);
apiRouter.use('/affiliates', affiliatesRouter);
apiRouter.use('/flows', flowsRouter);
apiRouter.use('/autodm', autodmRouter);
apiRouter.use('/landing', landingRouter);
apiRouter.use('/subscription', subscriptionRouter);
apiRouter.use('/account', accountRouter);
// Public Instagram OAuth callback must be registered before the authenticated
// integrations router (Facebook redirects here without our session cookie).
apiRouter.use('/integrations/instagram', instagramPublicRouter);
apiRouter.use('/integrations', integrationsRouter);
apiRouter.use('/assistant', assistantRouter);

// Passwordless customer portal (buyers — not creator accounts).
apiRouter.use('/portal', portalRouter);
