// const axios = require('axios');
// const fs = require('fs');
// const FormData = require('form-data');

const { default: axios } = require("axios");

// axios.post('http://localhost:8080/auth/login', {
//   login: 'sudip',
//   password: 'sudip'
// })
// .then(res => {
//   const token = res.data.token;
//   console.log("Token:", token);

//   return axios.get('http://localhost:8080/user', {
//     headers: { Authorization: `Bearer ${token}` }
//   }).then(() => token);
// })
// .then(token => {
//   const form = new FormData();
//   form.append('file', fs.createReadStream('./1.png'));

//   return axios.post('http://localhost:8080/files/upload-files', form, {
//     headers: {
//       ...form.getHeaders(),
//       Authorization: `Bearer ${token}`
//     }
//   }).then(res => {
//     console.log("File uploaded:", res.data);
//     return token;      // <----- ✅ RETURN the token here!
//   });
// })
// .then(token => {
//   return axios.get('http://localhost:8080/files/get-files/file-id=68727fbe0104d7bd56cb9b71', {
//     headers: {
//       Authorization: `Bearer ${token}`
//     },
//     responseType: 'arraybuffer'
//   });
// })
// .then(res => {
//   // Save the file locally
//   fs.writeFileSync('./downloaded.png', res.data);
//   console.log("Downloaded file saved!");
// })
// .catch(console.error);



axios.post()