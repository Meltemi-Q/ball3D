export default function handler(_req: any, res: any) {
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.status(200).send('ok')
}

