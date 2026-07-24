/**
 * Centralized Error Handling System
 * 
 * Provides structured error classes, error logging, and safe error responses.
 * Never exposes sensitive server details to clients.
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import logger from '@/lib/logger'

// ============ ERROR CLASSES ============

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', true, details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'প্রমাণীকরণ প্রয়োজন।') {
    super(message, 401, 'UNAUTHORIZED', true)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'এই কাজের জন্য অনুমতি নেই।') {
    super(message, 403, 'FORBIDDEN', true)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'তথ্য খুঁজে পাওয়া যায়নি।') {
    super(message, 404, 'NOT_FOUND', true)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'এই তথ্য ইতিমধ্যে বিদ্যমান।') {
    super(message, 409, 'CONFLICT', true)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'অনেক বেশি অনুরোধ। কিছুক্ষণ পর আবার চেষ্টা করুন।') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true)
    this.name = 'RateLimitError'
  }
}

export class PaymentError extends AppError {
  constructor(message: string, code: string = 'PAYMENT_ERROR') {
    super(message, 400, code, true)
    this.name = 'PaymentError'
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'ডাটাবেস ত্রুটি হয়েছে।', code: string = 'DATABASE_ERROR') {
    super(message, 500, code, true)
    this.name = 'DatabaseError'
  }
}

// ============ ERROR FORMATTER ============

function formatError(error: unknown): { message: string; statusCode: number; code: string; details?: unknown } {
  // AppError (our custom errors)
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    }
  }

  // ZodError (validation)
  if (error instanceof ZodError) {
    return {
      message: 'ইনপুট ভ্যালিডেশন ব্যর্থ',
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      details: (error.issues ?? []).map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    }
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Extract field names from meta when available
    const targetFields: string[] = Array.isArray(error.meta?.target)
      ? error.meta.target as string[]
      : typeof error.meta?.target === 'string'
        ? [error.meta.target as string]
        : []

    switch (error.code) {
      case 'P2002': { // Unique constraint violation
        const fieldHint = targetFields.length > 0
          ? ` (${targetFields.join(', ')})`
          : ''
        return {
          message: `এই তথ্য ইতিমধ্যে বিদ্যমান${fieldHint}।`,
          statusCode: 409,
          code: 'DUPLICATE_ENTRY',
        }
      }
      case 'P2025': // Record not found
        return {
          message: 'তথ্য খুঁজে পাওয়া যায়নি।',
          statusCode: 404,
          code: 'NOT_FOUND',
        }
      case 'P2003': { // Foreign key constraint
        const fieldHint = targetFields.length > 0
          ? ` (${targetFields.join(', ')})`
          : ''
        return {
          message: `সম্পর্কিত তথ্য খুঁজে পাওয়া যায়নি${fieldHint}।`,
          statusCode: 400,
          code: 'FOREIGN_KEY_ERROR',
        }
      }
      default:
        return {
          message: `ডাটাবেস ত্রুটি হয়েছে (${error.code})।`,
          statusCode: 500,
          code: 'DATABASE_ERROR',
        }
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    const isDev = process.env.NODE_ENV === 'development'
    return {
      message: 'ডাটাবেস ভ্যালিডেশন ত্রুটি।',
      statusCode: 400,
      code: 'DB_VALIDATION_ERROR',
      ...(isDev && { details: error.message }),
    }
  }

  // JSON parse error
  if (error instanceof SyntaxError) {
    const syntaxErr = error as { status?: number }
    if (syntaxErr.status === 400 || !syntaxErr.status) {
      return {
        message: 'অবৈধ JSON ফরম্যাট।',
        statusCode: 400,
        code: 'INVALID_JSON',
      }
    }
  }

  // Generic Error
  if (error instanceof Error) {
    // In production, don't expose internal error messages
    const isDev = process.env.NODE_ENV === 'development'
    return {
      message: isDev ? error.message : 'সার্ভার ত্রুটি হয়েছে। পরে আবার চেষ্টা করুন।',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      ...(isDev && { details: error.stack }),
    }
  }

  // Unknown error
  return {
    message: 'একটি অজানা ত্রুটি হয়েছে।',
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
  }
}

// ============ ERROR LOGGER ============

export function logError(error: unknown, context?: string): void {
  const errorInfo = formatError(error)

  if (errorInfo.statusCode >= 500) {
    logger.error(errorInfo.message, error, { context: context || 'api' })
  } else if (errorInfo.statusCode >= 400) {
    logger.warn(`${errorInfo.code}: ${errorInfo.message}`, { context: context || 'api' })
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      console.error(`[logError:${errorInfo.code}]`, error)
    }
  }
}

// ============ API ERROR RESPONSE ============

export function handleApiError(error: unknown, context?: string): NextResponse {
  logError(error, context)
  const { message, statusCode, code, details } = formatError(error)

  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      ...(details ? { details } : {}),
    },
    { status: statusCode }
  )
}

// ============ DATABASE TRANSACTION WRAPPER ============

export async function safeTransaction<T>(
  fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await db.$transaction(fn, {
        maxWait: 5000,
        timeout: 10000,
      })
    } catch (error) {
      lastError = error
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034') {
          continue
        }
      }
      throw error
    }
  }
  throw lastError
}
