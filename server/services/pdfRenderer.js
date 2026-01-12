
const puppeteer = require('puppeteer');

/**
 * Renders HTML content to a PDF buffer using Puppeteer (Headless Chrome).
 * @param {string} html - The HTML string to render.
 * @returns {Promise<Buffer>} - PDF file buffer.
 */
const renderPdfFromHtml = async (html) => {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for some container environments
        });
        
        const page = await browser.newPage();
        
        // Set content and wait for network to be idle to ensure styles/images load
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        return pdfBuffer;
    } catch (error) {
        console.error("[PdfRenderer] Error generating PDF:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

module.exports = { renderPdfFromHtml };
