import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const data = await prisma.card.findMany({ orderBy: { createdAt: 'asc' } })
      return res.json(data)
    }

    if (req.method === 'POST') {
      const { name, limit, color } = req.body
      const data = await prisma.card.create({
        data: { name, limit: parseFloat(String(limit)), color },
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
