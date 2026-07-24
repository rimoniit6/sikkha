import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'

// Public endpoint — returns only payment-related account numbers
// This is needed so the PaymentPage can show real bKash/Nagad/Rocket numbers
// without requiring admin authentication
export async function GET() {
  try {
    const paymentKeys = ['bkash', 'nagad', 'rocket', 'default_bkash_number', 'default_nagad_number', 'default_rocket_number']
    const settings = await db.siteSetting.findMany({
      where: {
        key: { in: paymentKeys },
      },
    })

    const keyMap: Record<string, string> = {
      bkash: 'bkash',
      nagad: 'nagad',
      rocket: 'rocket',
      default_bkash_number: 'bkash',
      default_nagad_number: 'nagad',
      default_rocket_number: 'rocket',
    }

    const accounts: Record<string, string> = {
      bkash: '',
      nagad: '',
      rocket: '',
    }

    for (const setting of settings) {
      if (setting.value) {
        const targetKey = keyMap[setting.key]
        if (targetKey) {
          accounts[targetKey] = setting.value
        }
      }
    }

    return NextResponse.json({ success: true, data: { accounts } })
  } catch (error) {
    return handleApiError(error, 'Get payment accounts error:')
  }
}
