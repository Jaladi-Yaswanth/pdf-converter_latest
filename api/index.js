require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const { exec } = require("child_process");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create necessary directories
['uploads', 'converted'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Static file serving
app.use(express.static(__dirname));
app.use("/converted", express.static(path.join(__dirname, "converted")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve laytest.html at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'laytest.html'));
});

// Configure email transporter
const emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL,
        pass: process.env.PASS,
    }
});

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Ensure filename is URL-safe
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeFilename = uniqueSuffix + path.extname(file.originalname).toLowerCase();
        cb(null, safeFilename);
    }
});
/*
const storage=multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,'/uploads');

    }
    ,filename:(req,file,cb)=>{
        const unique=Date.now()+'-'+Math.round(Math.random()*1E9);
        const safefilename=unique+path.extname(file.originalname).toLowerCase();
        cb(null,safefilename);
    }

});*/

const upload = multer({
    storage: storage,
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
const sendEmail = async (userEmail, pdfPath, filename) => {
    const emailOptions = {
        from: process.env.MAIL,
        to: userEmail,
        subject: "Your Converted PDF File",
        text: "Please find your converted PDF file attached.",
        attachments: [{
            filename: filename,
            path: pdfPath
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

// Add this route before the main /convert route
app.get('/converted/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'converted', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            error: 'File not found'
        });
    }

    // Set headers for direct download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
});

// Main route for file processing
app.post("/convert", upload.single("image"), async (req, res) => {
    console.log('Received conversion request');
    try {
        if (!req.file) {
            console.log('No file uploaded');
            return res.status(400).json({ 
                success: false,
                error: "No file uploaded" 
            });
        }

        console.log('File received:', req.file.filename);
        const convertedFilename = `${Date.now()}-converted.pdf`;
        const outputPath = path.join(__dirname, "converted", convertedFilename);

        console.log('Converting file...');
        // Convert image to PDF
        await executeCommand(`python converter.py "${req.file.path}" "${outputPath}"`);
        console.log('Conversion completed');

        // Clean up the uploaded file
        fs.unlinkSync(req.file.path);
        console.log('Cleaned up uploaded file');

        if (req.body.deliveryMethod === 'email') {
            if (!req.body.email) {
                return res.status(400).json({ 
                    success: false,
                    error: "Email address is required for email delivery" 
                });
            }

            console.log('Sending email...');
            await sendEmail(req.body.email, outputPath, convertedFilename);
            console.log('Email sent successfully');
            
            res.json({
                success: true,
                message: "PDF has been sent to your email",
                method: "email"
            });
        } else {
            console.log('Preparing download response');
            // Set headers for direct download
            res.setHeader('Content-Disposition', `attachment; filename="${convertedFilename}"`);
            res.setHeader('Content-Type', 'application/pdf');
            res.json({
                success: true,
                message: "PDF ready for download",
                method: "download",
                downloadUrl: `/converted/${convertedFilename}`,
                filename: convertedFilename
            });
        }

    } catch (error) {
        console.error("Error during processing:", error);
        res.status(500).json({
            success: false,
            error: error.message || "An error occurred during processing"
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size is too large. Maximum size is 5MB'
            });
        }
    }
    res.status(500).json({
        success: false,
        error: error.message || "An unexpected error occurred"
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Server directory: ${__dirname}`);
    console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
    console.log(`Converted directory: ${path.join(__dirname, 'converted')}`);
}); 
