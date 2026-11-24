import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { estimateBody, saveEstimate } from '@/lib/estimates';

export const PUT = officeWrite<'id', typeof estimateBody>('estimates.save', SELLERS, estimateBody, (tx, ctx, b, { id }) => saveEstimate(tx, ctx, id, b));
