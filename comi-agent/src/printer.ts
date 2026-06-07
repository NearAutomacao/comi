import * as net from 'net'

export interface PrintItem {
  name: string
  quantity: number
  notes: string | null
}

export interface PrintTicket {
  printer: 'kitchen' | 'bar'
  orderCode: number | null
  tableNumber: number | null
  guestName: string | null
  items: PrintItem[]
  createdAt: string
}

// Gera buffer ESC/POS sem dependência externa (raw commands)
function buildEscPos(ticket: PrintTicket): Buffer {
  const ESC = 0x1b
  const GS  = 0x1d
  const LF  = 0x0a

  const lines: Buffer[] = []

  const text = (s: string) => Buffer.from(s + '\n', 'latin1')
  const cmd  = (...bytes: number[]) => Buffer.from(bytes)

  // Init
  lines.push(cmd(ESC, 0x40))

  // Centralizar
  lines.push(cmd(ESC, 0x61, 0x01))

  // Negrito ON
  lines.push(cmd(ESC, 0x45, 0x01))
  const title = ticket.printer === 'kitchen' ? '*** COZINHA ***' : '*** BAR ***'
  lines.push(text(title))

  // Negrito OFF
  lines.push(cmd(ESC, 0x45, 0x00))

  lines.push(text('--------------------------------'))
  lines.push(cmd(ESC, 0x61, 0x00)) // Alinhar esquerda

  if (ticket.tableNumber != null) lines.push(text(`Mesa: ${ticket.tableNumber}`))
  if (ticket.guestName)           lines.push(text(`Comanda: ${ticket.guestName}`))
  if (ticket.orderCode != null)   lines.push(text(`Pedido: #${String(ticket.orderCode).padStart(3, '0')}`))

  const hora = new Date(ticket.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  lines.push(text(`Hora: ${hora}`))
  lines.push(text('--------------------------------'))

  // Itens
  for (const item of ticket.items) {
    lines.push(cmd(ESC, 0x45, 0x01))
    lines.push(text(`${item.quantity}x ${item.name}`))
    lines.push(cmd(ESC, 0x45, 0x00))
    if (item.notes) lines.push(text(`  >> ${item.notes}`))
  }

  lines.push(text('--------------------------------'))
  lines.push(text(''))
  lines.push(text(''))
  lines.push(text(''))

  // Cortar papel (partial cut)
  lines.push(cmd(GS, 0x56, 0x01))

  return Buffer.concat(lines)
}

export async function printTicket(host: string, port: number, ticket: PrintTicket): Promise<void> {
  if (!host) {
    console.log(`[printer] Host não configurado para ${ticket.printer} — imprimindo no console:`)
    console.log(`  Mesa ${ticket.tableNumber} | #${ticket.orderCode} | ${ticket.guestName}`)
    ticket.items.forEach(i => console.log(`  ${i.quantity}x ${i.name}`))
    return
  }

  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error(`Timeout ao conectar na impressora ${host}:${port}`))
    }, 5000)

    socket.connect(port, host, () => {
      const data = buildEscPos(ticket)
      socket.write(data, err => {
        clearTimeout(timeout)
        socket.end()
        if (err) reject(err)
        else resolve()
      })
    })

    socket.on('error', err => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}
