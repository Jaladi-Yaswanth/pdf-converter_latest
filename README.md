# Image to PDF Converter

A serverless application that converts images to PDF files, built with Vercel.

## Features

- Convert images (JPEG, PNG, GIF) to PDF
- Download converted PDFs directly
- Email PDFs to specified addresses
- Modern, responsive UI
- Serverless architecture

## Prerequisites

- Node.js 14.x or later
- Vercel CLI (`npm i -g vercel`)
- Python 3.x (for image conversion)
- Gmail account (for email functionality)

## Environment Variables

Create a `.env` file in the root directory with:

```
MAIL=your-gmail@gmail.com
PASS=your-app-specific-password
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
vercel dev
```

## Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

## Project Structure

```
vercelapp/
├── api/
│   └── convert.js      # API endpoint for conversion
├── public/
│   └── index.html      # Frontend interface
├── package.json        # Dependencies
├── vercel.json         # Vercel configuration
└── README.md          # Documentation
```

## API Endpoints

### POST /api/convert

Converts an image to PDF.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body:
  - image: Image file (JPEG, PNG, or GIF)
  - deliveryMethod: "download" or "email"
  - email: Email address (required if deliveryMethod is "email")

**Response:**
- For download: PDF file
- For email: JSON response with success/error message

## License

MIT 