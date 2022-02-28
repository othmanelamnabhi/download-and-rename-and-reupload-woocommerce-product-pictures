const express = require("express");
const app = express();
const fs = require("fs");
const download = require("download");

// liste des caractères spéciaux à remplacer
const mapObj = {
  à: "a",
  é: "e",
  è: "e",
  ù: "u",
  ë: "e",
  ä: "a",
  ü: "a",
  ë: "a",
  î: "i",
  ï: "i",
  ",": "-",
  ç: "c",
};

// regEx pour trouver l'extension d'un fichier
const fileExtensionRegex = /\.\w{3,4}($|\?)/g;

// Client permettant de se connecter à l'API woocommerce
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

const api = new WooCommerceRestApi({
  url: process.env.URL,
  consumerKey: process.env.CONSUMER_KEY,
  consumerSecret: process.env.CONSUMER_SECRET,
  version: "wc/v3",
});

// fonction permettant de remplacer les caractères accentués
function replaceAll(string, mapObj) {
  var re = new RegExp(Object.keys(mapObj).join("|"), "gi");

  return string.replace(re, function (matched) {
    return mapObj[matched.toLowerCase()];
  });
}

// l'API Woocommerce ne permet de mettre à jour que 100 produits à la fois, cette fonction permet de diviser les 274 produits en batch de 100
function spliceIntoChunks(arr, chunkSize) {
  const res = [];
  while (arr.length > 0) {
    const chunk = arr.splice(0, chunkSize);
    res.push(chunk);
  }
  return res;
}

// 1ère étape: récupérer tous les produits depuis woocommerce et les stocker dans un fichier JSON
app.get("/get-all-products", async (req, res) => {
  let allProducts = [];
  let page = 1;

  while (page !== false) {
    console.log("page => ", page);
    fs.appendFileSync("message.txt", `page => ${page} \n`);
    let wcResponse = await api.get("products", {
      per_page: 100,
      status: "publish",
      page,
    });
    const products = await wcResponse.data;

    if (products.length > 0) {
      allProducts = allProducts.concat(products);
      page++;
    } else {
      page = false;
    }
  }
  fs.writeFileSync("allproducts.json", JSON.stringify(allProducts));
  return res.json(allProducts);
});

// 2ème étape: filtrer le fichier pour ne garder que les 3 marques l'Oréal et sauvearder sur un fichier JSON
app.get("/process-json-file", (req, res) => {
  const rawData = fs.readFileSync("allproducts.json");
  const products = JSON.parse(rawData);
  console.log(products.length);

  const filteredArray = products.filter((product) => {
    return (
      product.brands[0]?.id === 331 ||
      product.brands[0]?.id === 333 ||
      product.brands[0]?.id === 334
    );
  });

  fs.writeFileSync("allfilteredproducts.json", JSON.stringify(filteredArray));
  return res.json(filteredArray);
});

// 3ème étape: reformater le document au format demandé par Woocommerce et ne garder que les infos essentielles. (ID du produit, id des images, liens des images)
// en profiter aussi pour remplacer les caractères speciaux et les espaces par des tirets comme demandé par Lily et les remplacer sur le nouveau fichier enregistré.
app.get("/process-product-names", (req, res) => {
  const rawData = fs.readFileSync("allfilteredproducts.json");
  const products = JSON.parse(rawData);

  const renamedProducts = products.map((product) => {
    const editedProduct = {};

    const newAltTag = replaceAll(product.name, mapObj)
      .replace(/( \| )|(\|)/g, " ")
      .toLowerCase();
    const editedProductName = newAltTag.replace(/ /g, "-");

    editedProduct.id = product.id;
    editedProduct.name = editedProductName;
    editedProduct.images = product.images.map((image) => {
      const imageObj = {};
      imageObj.id = image.id;
      imageObj.alt = newAltTag;
      imageObj.src = image.src;
      return imageObj;
    });

    return editedProduct;
  });

  fs.writeFileSync("renamedproducts.json", JSON.stringify(renamedProducts));
  return res.json(renamedProducts);
});

// 4ème étape: télécharger toutes les images des 3 marques dispo sur le site, et les renommer selon spécifications Acquisit, générer un nouveau fichier JSON avec les infos relatives aux images avec nouveaux noms.
app.get("/download-rename-pictures", (req, res) => {
  const rawData = fs.readFileSync("renamedproducts.json");
  const products = JSON.parse(rawData);

  products.forEach(async (product) => {
    for (let i = 0; i < product.images.length; i++) {
      const fileExtension = product.images[i].src.match(fileExtensionRegex);
      await download(encodeURI(product.images[i].src), "./images", {
        filename: `${product.name}-${i + 1}${fileExtension}`,
      });
    }
  });

  const arrayOfUpdates = products.map((product) => {
    const updatedProduct = {};
    updatedProduct.id = product.id;

    updatedProduct.images = product.images.map((image, index) => {
      const fileExtension = image.src.match(fileExtensionRegex);
      download(encodeURI(image.src), "./images", {
        filename: `${product.name}-${index + 1}${fileExtension}`,
      });
      const imageObj = {};
      //   imageObj.id = image.id;
      imageObj.alt = image.alt;
      imageObj.name = image.alt;
      imageObj.src = `${process.env.URL}/images/${product.name}-${
        index + 1
      }${fileExtension}`;
      return imageObj;
    });

    return updatedProduct;
  });

  fs.writeFileSync("jsonToUpload.json", JSON.stringify(arrayOfUpdates));
  return res.json(arrayOfUpdates);
});

// 5ème étape (manuelle et rapide): upload les 45mb de fichiers images dans le FTP du site

// 6ème étape: lancer le process de mise à jour depuis l'API Woocommerce, en lui fournissant les liens des images sur le serveur ainsi que les nouveaux noms et ALT.
app.get("/update-product", (req, res) => {
  const rawData = fs.readFileSync("jsonToUpload.json");
  const products = JSON.parse(rawData);

  const splicedArray = spliceIntoChunks(products, 100);

  res.json(splicedArray);

  splicedArray.forEach((batch) => {
    api
      .post("products/batch", { update: batch })
      .then((response) => {
        console.log(response.data);
      })
      .catch((error) => {
        console.log(error.response.data);
      });
  });
});

app.listen(3000, () => {
  console.log(`Example app listening on port 3000`);
});
