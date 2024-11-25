const axios = require('axios');

/**
 * Generate a custom QR code with rounded borders and colorful dots using the QRCode API.
 * @param {string} text - The text or URL to encode in the QR code.
 * @returns {Promise<string>} - A promise that resolves to the data URL of the generated QR code in the selected format.
 */
const generateCustomQRCode = async (text) => {
    try {
        const apiKey = 'zvjOYwhhM3hfwUGaINUUo8URN6h9sNWcbBhqgGPpClO2LcJiACRnaS-XHnZFlOzm'; // Replace with your QRCode API key
        const apiUrl = `https://api.qr-code-generator.com/v1/create?access-token=${apiKey}`;

        // Define payload with custom design parameters for rounded borders and colorful dots
        const payload = {
            qr_code_text: text,  // The text to encode (e.g., URL)
            image_format: "JPG",  // You can choose JPG, PNG, SVG, or EPS
            image_width: 500,      // Size of the generated image
            download: 0,           // Return data (use 1 for download to browser)
            foreground_color: "#FF33A1", // Color for the QR code body (e.g., red)
            background_color: "#FFFFFF", // Background color (white)
            marker_left_inner_color: "#33AFFF", // Color for inner of the top-left marker
            marker_left_outer_color: "#33AFFF", // Outer color for top-left marker
            marker_right_inner_color: "#33AFFF", // Inner color for top-right marker
            marker_right_outer_color: "#33AFFF", // Outer color for top-right marker
            marker_bottom_inner_color: "#33AFFF", // Inner color for bottom-left marker
            marker_bottom_outer_color: "#33AFFF", // Outer color for bottom-left marker
            marker_left_template: "version4",   // Rounded markers for the left position
            marker_right_template: "version4",  // Rounded markers for the right position
            marker_bottom_template: "version4", // Rounded markers for the bottom position
            frame_color: "#000000",  // Frame color around the QR code (black)
            frame_name: "no-frame"   // No frame around the QR code
        };

        // Make API request to generate the QR code
        const response = await axios.post(apiUrl, payload, {
            responseType: 'arraybuffer'  // Get the binary response for the image
        });

        // Convert binary data to base64 URL for inline display
        const qrCodeDataUrl = `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;

        console.log("Custom QR Code generated successfully.");
        return qrCodeDataUrl; // Return the generated QR code as a data URL

    } catch (error) {
        console.error("Error generating custom QR code:", error.message);
        throw new Error("QR Code generation failed.");
    }
};

module.exports = generateCustomQRCode;
