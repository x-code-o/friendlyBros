const QRCode = require('qrcode');

/**
 * Generate a QR code as a data URL or save it as a file.
 * @param {string} text - The text or URL to encode in the QR code.
 * @returns {Promise<string>} - A promise that resolves to a data URL of the generated QR code.
 */
const generateQRCode = async (text) => {
    try {
        // Generate QR code as a data URL (Base64-encoded image)
        const qrCodeDataUrl = await QRCode.toDataURL(text);

        console.log("QR Code generated successfully");
        return qrCodeDataUrl; // Return the QR code as a data URL
    } catch (error) {
        console.error("Error generating QR code:", error);
        throw new Error("QR Code generation failed.");
    }
};

module.exports = generateQRCode;
