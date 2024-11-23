const QRCode = require('qrcode');
const { createCanvas } = require('canvas');

/**
 * Generate a stylish QR code with circular design, black border, and custom center color.
 * @param {string} text - The text or URL to encode in the QR code.
 * @returns {Promise<string>} - A promise that resolves to a data URL of the generated QR code.
 */
const generateQRCode = async (text) => {
    try {
        // Set size for the QR code and canvas
        const size = 400;
        const margin = 10;  // Define a margin to avoid QR code data being clipped
        const qrSize = size - margin * 2;  // Adjust QR size based on margin
        const qrCanvas = createCanvas(qrSize, qrSize);

        // Generate the QR code onto the canvas
        await QRCode.toCanvas(qrCanvas, text, {
            errorCorrectionLevel: 'H',
            margin: margin
        });

        // Create a new canvas to create the circular QR code design
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // Random center color
        const randomColor = `hsl(${Math.random() * 360}, 100%, 50%)`; // Random hue color

        // Draw a black circular border
        const radius = size / 2;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'black';
        ctx.fill();

        // Draw a smaller circle in the center with the random color
        const innerRadius = radius - 20; // Slightly smaller than the outer circle
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, innerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = randomColor;
        ctx.fill();

        // Create a circular mask and apply it to the QR code
        ctx.save(); // Save current drawing state
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, innerRadius, 0, 2 * Math.PI);
        ctx.clip(); // Set the clipping region to the circle

        // Draw the QR code onto the circular mask
        ctx.drawImage(qrCanvas, margin, margin, qrSize, qrSize); // Position the QR code inside the circle
        ctx.restore(); // Restore drawing state to remove clipping mask

        // Draw the "Scan Me" text on the border
        ctx.font = '24px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('', size / 2, size / 2);

        // Convert the styled canvas to a data URL
        const qrCodeDataUrl = canvas.toDataURL();

        console.log("QR Code generated successfully");
        return qrCodeDataUrl; // Return the QR code as a data URL
    } catch (error) {
        console.error("Error generating QR code:", error);
        throw new Error("QR Code generation failed.");
    }
};

module.exports = generateQRCode;
