import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseInt(req.query.id as string)
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' })

  try {
    if (req.method === 'DELETE') {
      // Cascade deleta contributions automaticamente (definido no schema)
      await prisma.goal.delete({ where: { id } })
      return res.json({ ok: true })
    }

    res.setHeader('Allow', ['DELETE'])
    res.status(405).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
