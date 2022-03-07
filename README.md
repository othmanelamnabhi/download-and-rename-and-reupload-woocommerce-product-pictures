
# download-and-rename-and-reupload-woocommerce-product-pictures

Images with Alt tags and clear naming improve a website's SEO.
But when you have thousands of images to rename, things can get complicated pretty quickly.

That's the situation I found myself in, before deciding to make this express app.
I could just written one script that does it in one ago, but the idea break up this big task into littles ones so as to not lose progress (if something was to happen such as a computer crash or loss of connectivity)

## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`URL`

`CONSUMER_KEY`

`CONSUMER_SECRET`

You can get the last two values from WooCommerce settings.

## Installation

Access the project directory in your terminal then `npm install` to install your dependencies.
    
## Usage
`npm run watch` launches the express server locally, from there you can access any of the endpoints available on this project through Postman or Insomnia.

- /get-all-products
- /process-json-file
- /process-product-names
- /download-rename-pictures
- /update-product
