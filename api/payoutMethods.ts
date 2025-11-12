import type { PayoutAccountType } from '../types';
import { db } from './db';

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const isValidType = (value: unknown): value is PayoutAccountType =>
  value === 'Bank' || value === 'MobileMoney';

interface BaseRequest {
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown> | null;
  params?: Record<string, string | undefined>;
}

const resolveUserId = (req: BaseRequest): string | undefined =>
  (req.query?.userId as string | undefined) ??
  (req.body?.userId as string | undefined);

export async function handleGetPayoutMethods(req: BaseRequest) {
  const userId = resolveUserId(req);
  if (!userId) {
    return jsonResponse({ message: 'userId is required.' }, 400);
  }

  const methods = db.payoutMethods.findByUserId(userId);
  return jsonResponse({ data: methods });
}

export async function handleCreatePayoutMethod(req: BaseRequest) {
  const { body } = req;
  if (!body) {
    return jsonResponse({ message: 'Request body is required.' }, 400);
  }

  const userId = body.userId as string | undefined;
  const type = body.type as PayoutAccountType | undefined;
  const accountInfo = body.accountInfo as string | undefined;
  const bankName = body.bankName as string | undefined;
  const bankCode = body.bankCode as string | undefined;
  const accountNumber = body.accountNumber as string | undefined;
  const mobileMoneyProvider = body.mobileMoneyProvider as string | undefined;
  const phoneNumber = body.phoneNumber as string | undefined;
  const isDefault = body.isDefault as boolean | undefined;

  if (!userId || !isValidType(type) || !accountInfo) {
    return jsonResponse({ message: 'userId, type, and accountInfo are required.' }, 400);
  }

  if (type === 'Bank') {
    if (!bankName || !bankCode || !accountNumber) {
      return jsonResponse(
        { message: 'bankName, bankCode, and accountNumber are required for bank accounts.' },
        400
      );
    }
  } else if (!mobileMoneyProvider || !phoneNumber) {
    return jsonResponse(
      { message: 'mobileMoneyProvider and phoneNumber are required for mobile money accounts.' },
      400
    );
  }

  const normalizedAccountNumber = accountNumber?.replace(/\s+/g, '');
  const normalizedPhoneNumber = phoneNumber?.replace(/\s+/g, '');

  const record = db.payoutMethods.create({
    userId,
    type,
    accountInfo,
    bankName,
    bankCode,
    accountNumber: normalizedAccountNumber,
    mobileMoneyProvider,
    phoneNumber: normalizedPhoneNumber,
    isDefault,
  });

  return jsonResponse({ data: record }, 201);
}

export async function handleUpdatePayoutMethod(req: BaseRequest) {
  const id = req.params?.id;
  if (!id) {
    return jsonResponse({ message: 'Payout method id is required.' }, 400);
  }
  if (!req.body) {
    return jsonResponse({ message: 'Request body is required.' }, 400);
  }

  const updates = { ...req.body };
  if (updates.type && !isValidType(updates.type)) {
    return jsonResponse({ message: 'Invalid payout method type.' }, 400);
  }

  const normalizedAccountNumber = (updates.accountNumber as string | undefined)?.replace(/\s+/g, '');
  const normalizedPhoneNumber = (updates.phoneNumber as string | undefined)?.replace(/\s+/g, '');

  const method = db.payoutMethods.update(id, {
    type: updates.type as PayoutAccountType | undefined,
    accountInfo: updates.accountInfo as string | undefined,
    bankName: updates.bankName as string | undefined,
    bankCode: updates.bankCode as string | undefined,
    accountNumber: normalizedAccountNumber,
    mobileMoneyProvider: updates.mobileMoneyProvider as string | undefined,
    phoneNumber: normalizedPhoneNumber,
    isDefault: updates.isDefault as boolean | undefined,
    makeDefault: updates.isDefault === true ? true : undefined,
  });

  if (!method) {
    return jsonResponse({ message: 'Payout method not found.' }, 404);
  }

  return jsonResponse({ data: method });
}

export async function handleDeletePayoutMethod(req: BaseRequest) {
  const id = req.params?.id;
  if (!id) {
    return jsonResponse({ message: 'Payout method id is required.' }, 400);
  }

  const deleted = db.payoutMethods.delete(id);
  if (!deleted) {
    return jsonResponse({ message: 'Payout method not found.' }, 404);
  }

  return jsonResponse({ success: true });
}
