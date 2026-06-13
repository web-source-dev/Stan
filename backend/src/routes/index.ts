import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { creatorRouter } from '../modules/creator/creator.routes';
import { storefrontRouter } from '../modules/storefront/storefront.routes';
import { cloudinaryRouter } from '../modules/cloudinary/cloudinary.routes';
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
import { learnRouter } from '../modules/learn/learn.routes';
import { bookingTypesRouter, bookingsRouter } from '../modules/bookings/bookings.routes';
import { referralsRouter } from '../modules/referrals/referrals.routes';
import { flowsRouter } from '../modules/flows/flows.routes';
import { autodmRouter } from '../modules/autodm/autodm.routes';
import { landingRouter } from '../modules/landing/landing.routes';
import { subscriptionRouter } from '../modules/subscription/subscription.routes';
import { accountRouter } from '../modules/account/account.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/creator', creatorRouter);
apiRouter.use('/storefront', storefrontRouter);
apiRouter.use('/cloudinary', cloudinaryRouter);
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
apiRouter.use('/learn', learnRouter);
apiRouter.use('/booking-types', bookingTypesRouter);
apiRouter.use('/bookings', bookingsRouter);

// Growth & monetization modules
apiRouter.use('/referrals', referralsRouter);
apiRouter.use('/flows', flowsRouter);
apiRouter.use('/autodm', autodmRouter);
apiRouter.use('/landing', landingRouter);
apiRouter.use('/subscription', subscriptionRouter);
apiRouter.use('/account', accountRouter);
