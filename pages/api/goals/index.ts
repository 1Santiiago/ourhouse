import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const data = await prisma.goal.findMany({
        include: { contributions: { orderBy: { date: 'desc' } } },
        orderBy: { createdAt: 'asc' },
      })
      return res.json(data)
    }

    if (req.method === 'POST') {
      const { emoji, name, color, target, deadline } = req.body
      const data = await prisma.goal.create({
        data: { emoji, name, color, target: parseFloat(String(target)), deadline },
        include: { contributions: true },
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
