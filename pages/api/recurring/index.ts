import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const data = await prisma.recurring.findMany({ orderBy: { createdAt: 'asc' } })
      return res.json(data)
    }
    if (req.method === 'POST') {
      const { type, description, amount, category, paymentMethod, dayOfMonth, cardId } = req.body
      const data = await prisma.recurring.create({
        data: {
          type, description,
          amount: parseFloat(String(amount)),
          category, paymentMethod,
          dayOfMonth: parseInt(String(dayOfMonth)),
          cardId: cardId ? parseInt(String(cardId)) : null,
        }
      })
      return res.json(data)
    }
    res.status(405).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno' })
  }
}