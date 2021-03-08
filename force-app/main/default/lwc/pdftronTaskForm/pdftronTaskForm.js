import { LightningElement, api, track, wire } from 'lwc';
import getRecordAttachments from "@salesforce/apex/PDFTron_Task_Creator.getRecordAttachments";
import apexSearch from '@salesforce/apex/PDFTron_Task_Creator.search';
import createTask from '@salesforce/apex/PDFTron_Task_Creator.createTaskFromJob';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PdftronTaskForm extends NavigationMixin(LightningElement) {
    //task fields
    subject;
    priority;
    status;
    assignedTo;
    contentversion;

    //can be retrieved dynamically / by record type if necessary
    priorityPicklistValues = [
        { label: 'High', value: 'High' },
        { label: 'Normal', value: 'Normal' },
        { label: 'Low', value: 'Low' },
    ];
    statusPicklistValues = [
        { label: 'Not started', value: 'Not started' },
        { label: 'In Progress', value: 'In Progress' },
        { label: 'Completed', value: 'Completed' },
        { label: 'Waiting on someone else', value: 'Waiting on someone else' },
        { label: 'Deferred', value: 'Deferred' },
    ];

    error;//display errors on top of component

    @api recordId; //see .js-meta.xml
    @track value = ''; //selected value
    @track loadFinished = false; //flag for conditional rendering
    @track picklistOptions = [];

    @wire(getRecordAttachments, { recordId: "$recordId", encode: "false" })
    attachments({ error, data }) {
        console.log(data);
        if (data) {
            data.forEach((attachmentRecord) => {
                var name = attachmentRecord.title;
                const option = {
                    label: name,
                    value: JSON.stringify(attachmentRecord)
                };
                this.picklistOptions = [...this.picklistOptions, option];
            });
            error = undefined;
            this.loadFinished = true;
        } else if (error) {
            console.error(error);
            this.error = error;
            this.picklistOptions = undefined;
            let def_message = 'We have encountered an error while loading up your document(s). '

            this.showNotification('Error', def_message + error.body.message, 'error');
        }
    };

    addTask() {
        let task = {};

        //add any fields here, include onchange handler as function below
        task.subject = this.subject;
        task.priority = this.priority;
        task.status = this.status;
        task.description = this.description;
        task.assignedto = this.assignedTo;
        task.contentversion = this.contentversion.recordId;
        task.relatedto = this.recordId;

        console.log(JSON.stringify(task)); //you can use this for input to JSON2Apex to automatically build a wrapper class/method for decoding

        console.log(`Creating task... => ${JSON.stringify(task)}`);
        createTask({ data: JSON.stringify(task) })
            .then((result) => {
                console.log(result);
                this.error = undefined;
                this.showNotification('Success', `Successfully created Task! (ID: ${result}). `, 'success');
                this.navigateToTaskPage(result);
            })
            .catch((error) => {
                this.error = error;
                console.error(error);
                this.showNotification('Error', error.body.message, 'error');
            });
    }

    navigateToTaskPage(record) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: record,
                objectApiName: 'Task',
                actionName: 'view'
            }
        });
    }

    handleSearch(event) {
        const lookupElement = event.target;
        console.log(`Searching ${JSON.stringify(event.detail)}`);
        apexSearch(event.detail)
            .then(results => {
                lookupElement.setSearchResults(results);
            })
            .catch(error => {
                // TODO: handle error
                this.showNotification('Error', error.body.message, 'error');
            });
    }

    //assigned to custom lookup handler
    handleSelectionChange(event) {
        console.log(`Selected assignee: ${event.detail}`);
        this.assignedTo = event.detail[0]; //task can only handle 1 assignee, so no multiple selection handling needed
    }

    handleDescriptionChange(event) {
        console.log(`Description: ${JSON.stringify(event.detail)}`);
        this.description = event.detail.value;
    }

    handleStatusChange(event) {
        console.log(`Selected status: ${JSON.stringify(event.detail)}`);
        this.status = event.detail.value;
    }

    handlePriorityChange(event) {
        console.log(`Selected priority: ${JSON.stringify(event.detail)}`);
        this.priority = event.detail.value;
    }

    handleSubjectChange(event) {
        console.log(`Selected subject: ${JSON.stringify(event.detail)}`);
        this.subject = event.detail.value;
    }

    //related documents change handler
    handleChange(event) {
        console.log(`Document: ${event.detail.value}`);
        this.contentversion = JSON.parse(event.detail.value); //due to coming from wrapper, string needs to be parsed to Obj
    }

    //toast
    showNotification(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(evt);
    }
}