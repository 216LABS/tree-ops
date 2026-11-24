import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { phcBody, recordApplication } from '@/lib/phc';

export const POST = officeWrite('phc.record', SELLERS, phcBody, (tx, ctx, b) => recordApplication(tx, ctx, b));
