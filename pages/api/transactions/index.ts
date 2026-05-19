import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const data = await prisma.transaction.findMany({ orderBy: { date: 'desc' } })
      return res.json(data)
    }

    if (req.method === 'POST') {
      const { type, description, amount, category, date, paymentMethod, cardId } = req.body
      const data = await prisma.transaction.create({
        data: {
          type,
          description,
          amount: parseFloat(String(amount)),
          category,
          date,
          paymentMethod,
          cardId: cardId ? parseInt(String(cardId)) : null,
        },
      })
      return res.json(data)
    }

    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
