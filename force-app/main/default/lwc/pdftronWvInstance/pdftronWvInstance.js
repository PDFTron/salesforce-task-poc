import { LightningElement, wire, api } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import libUrl from '@salesforce/resourceUrl/lib';
import myfilesUrl from '@salesforce/resourceUrl/myfiles';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import mimeTypes from './mimeTypes'

import getRelatedDocuments from '@salesforce/apex/PDFTron_Task_Creator.getRelatedDocuments';

function _base64ToArrayBuffer(base64) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export default class PdftronWvInstance extends LightningElement {
  error;
  @api recordId;
  cvId;
  fullAPI = false;

  constructor() {
    super();
  }

  @wire(getRelatedDocuments, { recordId: "$recordId" })
  document( {error, data }) {
    if(data) {
      console.log(data);
      let { body, title, recordId } = data;
      let extension = title.substring(title.lastIndexOf('.') + 1); //get filetype from title

      const blob = new Blob([_base64ToArrayBuffer(body)], {
        type: mimeTypes[extension]
      });
  
      const payload = {
        blob: blob,
        extension: extension,
        filename: title,
        documentId: recordId
      };
      this.iframeWindow.postMessage({ type: 'OPEN_DOCUMENT_BLOB', payload }, '*');

    } else if (error) {
      this.error = error;
      console.error(error);
    }
  }

  connectedCallback() {
    //this.cvId = this.task.data.fields.ContentVersion_Id__c.value;
  }

  disconnectedCallback() {
  }

  renderedCallback() {
    var self = this;
    if (this.uiInitialized) {
      return;
    }
    this.uiInitialized = true;

    Promise.all([
      loadScript(self, libUrl + '/webviewer.min.js')
    ])
      .then(() => this.initUI())
      .catch(console.error);
  }

  initUI() {
    var myObj = {
      libUrl: libUrl,
      fullAPI: this.fullAPI || false,
      namespacePrefix: '',
    };
    var url = myfilesUrl + '/webviewer-demo-annotated.pdf';

    const viewerElement = this.template.querySelector('div')
    // eslint-disable-next-line no-unused-vars
    const viewer = new PDFTron.WebViewer({
      path: libUrl, // path to the PDFTron 'lib' folder on your server
      custom: JSON.stringify(myObj),
      backendType: 'ems',
      config: myfilesUrl + '/config_apex.js',
      fullAPI: this.fullAPI
      // l: 'YOUR_LICENSE_KEY_HERE',
    }, viewerElement);

    viewerElement.addEventListener('ready', () => {
      this.iframeWindow = viewerElement.querySelector('iframe').contentWindow;
    })
  }
}