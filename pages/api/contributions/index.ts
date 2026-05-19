import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const { goalId, amount, date, note } = req.body
      const data = await prisma.contribution.create({
        data: {
          goalId: parseInt(String(goalId)),
          amount: parseFloat(String(amount)),
          date,
          note: note ?? '',
        },
      })
      return res.json(data)
    }

    res.setHeader('Allow', ['POST'])
    res.status(405).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
