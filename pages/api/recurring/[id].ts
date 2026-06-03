import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseInt(req.query.id as string)
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    if (req.method === 'DELETE') {
      await prisma.recurring.delete({ where: { id } })
      return res.json({ ok: true })
    }
    if (req.method === 'PATCH') {
      const { active } = req.body
      const data = await prisma.recurring.update({ where: { id }, data: { active } })
      return res.json(data)
    }
    res.status(405).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno' })
  }
}