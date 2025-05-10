const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { exec } = require('child_process');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for memory storage (Vercel doesn't support disk storage)
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Configure email transporter
const emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL,
        pass: process.env.PASS,
    }
});

// Helper function to execute shell commands
const executeCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Command execution error:', error);
                console.error('stderr:', stderr);
                reject(error);
            } else {
                console.log('stdout:', stdout);
                resolve({ stdout, stderr });
            }
        });
    });
};

// Helper function to send email
const sendEmail = async (userEmail, pdfBuffer, filename) => {
    const emailOptions = {
        from: process.env.MAIL,
        to: userEmail,
        subject: "Your Converted PDF File",
        text: "Please find your converted PDF file attached.",
        attachments: [{
            filename: filename,
            content: pdfBuffer
        }]
    };

    try {
        await emailTransporter.sendMail(emailOptions);
        console.log(`Email sent successfully to ${userEmail}`);
    } catch (error) {
        console.error('Email sending error:', error);
        throw error;
    }
};

// Main route for file processing
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Handle file upload
        upload.single('image')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ 
                    success: false,
                    error: err.message 
                });
            }

            if (!req.file) {
                return res.status(400).json({ 
                    success: false,
                    error: "No file uploaded" 
                });
            }

            // Create a temporary file
            const tempInputPath = `/tmp/${Date.now()}-input${path.extname(req.file.originalname)}`;
            const tempOutputPath = `/tmp/${Date.now()}-output.pdf`;

            // Write the uploaded file to temp directory
            fs.writeFileSync(tempInputPath, req.file.buffer);

            try {
                // Convert image to PDF
                await executeCommand(`python converter.py "${tempInputPath}" "${tempOutputPath}"`);
                
                // Read the converted PDF
                const pdfBuffer = fs.readFileSync(tempOutputPath);

                if (req.body.deliveryMethod === 'email') {
                    if (!req.body.email) {
                        return res.status(400).json({ 
                            success: false,
                            error: "Email address is required for email delivery" 
                        });
                    }

                    await sendEmail(req.body.email, pdfBuffer, 'converted.pdf');
                    
                    res.json({
                        success: true,
                        message: "PDF has been sent to your email",
                        method: "email"
                    });
                } else {
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'attachment; filename=converted.pdf');
                    res.send(pdfBuffer);
                }

                // Clean up temporary files
                fs.unlinkSync(tempInputPath);
                fs.unlinkSync(tempOutputPath);

            } catch (error) {
                console.error("Error during processing:", error);
                res.status(500).json({
                    success: false,
                    error: error.message || "An error occurred during processing"
                });
            }
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "An unexpected error occurred"
        });
    }
}; 