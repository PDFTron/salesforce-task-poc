/*
    PDFTron_Task_Creator.cls
    @Author: twinter@pdftron.com
    @Description: 
    Class used for:
    custom lookup search, 
    to get attachments from current record page + Wrapper for passing data to LWC
    passing LWC data to Apex to create new Tasks
*/

public with sharing class PDFTron_Task_Creator {
    //search logic for 'Assigned To' field
    @AuraEnabled
    public static List<LookupSearchResult> search(String searchTerm, List<String> selectedIds){
        try {
            Integer MAX_RESULTS = 10;
            // Prepare query paramters
            searchTerm += '*';

            // Execute search query
            List<List<SObject>> searchResults = [
                FIND :searchTerm
                IN ALL FIELDS
                RETURNING
                    User(Id, UserName, FirstName, LastName WHERE id NOT IN :selectedIds)
                LIMIT :MAX_RESULTS
            ];

            // Prepare results
            List<LookupSearchResult> results = new List<LookupSearchResult>();

            // Extract Accounts & convert them into LookupSearchResult
            String userIcon = 'standard:user';
            User[] users = (List<User>) searchResults[0];
            for (User user : users) {
                String subtitle = user.UserName == null ? 'User' : user.UserName; // show username/email as subtitle when present
                results.add(new LookupSearchResult(user.Id, 'User', userIcon, user.FirstName + ' ' + user.LastName, subtitle));
            }

            // Sort by name (optional)
            results.sort();

            return results;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    //takes current Record Detail page's Id and returns all attachments
    @AuraEnabled(Cacheable=true)
    public static List<DocumentWrapper> getRecordAttachments(String recordId, Boolean encode){
        try {
            /*
                To get related Files we need to go this route:
                (Task ->) Job Record -> ContentDocumentLink -> ContentDocument -> ContentVersion
            */
            List<DocumentWrapper> dwList = new List<DocumentWrapper> ();

            //store contentdocumentlinks
            Set<Id> cdlIdList = new Set<Id> ();

            //Define supported file extensions - optional
            Set<String> fileFormats = new Set<String> {
                'pdf',
                'docx'
            };

            //Find links between record & document
            for(ContentDocumentLink cdl : 
                    [   SELECT ContentDocumentId
                        FROM ContentDocumentLink 
                        WHERE LinkedEntityId = :recordId    ]) {
                cdlIdList.add(cdl.ContentDocumentId);
            }

            //Use ContentDocument IDs to get attachments
            for(ContentVersion cv : 
                    [   SELECT Id, Title,FileExtension, VersionData 
                        FROM ContentVersion 
                        WHERE ContentDocumentId IN :cdlIdList 
                        AND IsLatest = true ]) {
                if(fileFormats.contains(cv.FileExtension.toLowerCase())) { //optional check for file format
                    dwList.add(new DocumentWrapper(cv, encode));
                }
            }

            return dwList;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    //uses LWC data to create new Task
    @AuraEnabled
    public static String createTaskFromJob(String data) {
        TaskWrapper tw = new TaskWrapper();
        tw = tw.parse(data); //workaround due to wrapper being inner class - JSON entries must match TaskWrapper fields

        //unwrap data into Task object
        Task t = new Task();
        t.Subject = tw.subject;
        t.priority = tw.priority;
        t.status = tw.status;
        t.description = tw.description;
        t.OwnerId = tw.assignedto;
        t.ContentVersion_Id__c = tw.contentversion;
        t.WhatId = tw.relatedto;

        insert t;

        return t.Id; //return Id for navigating to record
    }

    //gets Task's associated Documents to open by default
    @AuraEnabled(Cacheable=true)
    public static DocumentWrapper getRelatedDocuments(String recordId) {
        String cvId = [SELECT ContentVersion_Id__c FROM Task WHERE Id = :recordId].ContentVersion_Id__c;
        return new DocumentWrapper([SELECT VersionData, Title, FileExtension FROM ContentVersion WHERE Id = :cvId AND IsLatest = true LIMIT 1], true);
    }

    public class DocumentWrapper {
        @AuraEnabled
        public String recordId {get;set;}
        @AuraEnabled
        public String title {get;set;}
        @AuraEnabled
        public String body {get;set;}

        public DocumentWrapper(ContentVersion cv, Boolean encode) {
            this.recordId = cv.Id;
            this.title = cv.Title + '.' + cv.FileExtension;
            if(encode == true) {
                this.body = EncodingUtil.base64Encode(cv.VersionData);
            } else {
                this.body = '';
            }
        }
    }

    //
    // Generated by JSON2Apex http://json2apex.herokuapp.com/
    //

    public class TaskWrapper {
        public String subject {get;set;}
        public String priority {get;set;}
        public String status {get;set;}
        public String description {get;set;}
        public String assignedto {get;set;}
        public String contentversion {get;set;}
        public String relatedto {get;set;}

        
        public /*static*/ TaskWrapper parse(String json) {
            return (TaskWrapper) System.JSON.deserialize(json, TaskWrapper.class);
        }
    }
}
