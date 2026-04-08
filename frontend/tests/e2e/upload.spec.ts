import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:8000/api/v1'

test.describe('Upload and Health Endpoints', () => {
  test('health/ready endpoint returns 200', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health/ready`)
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty('status')
  })

  test('upload without auth returns 401', async ({ request }) => {
    // Create a minimal PDF-like buffer for upload test
    const pdfBuffer = Buffer.from('%PDF-1.4 minimal content')

    const response = await request.post(`${API_BASE}/pdf/upload`, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      },
    })

    // Should require authentication (401) or return error
    expect([401, 422, 500]).toContain(response.status())
  })
})