/**
 * Copyright 2015 Atsushi Kojo.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
  'use strict';
  var ftp = require('ftp');
  var fs = require('fs');
  const mime = require('mime-types');
  var JefNode = require('json-easy-filter').JefNode;
  var bufferConcat = require('buffer-concat');

  const {
  encode,
  decode
} = require('./id.js');

    const ReadableStream = require('stream');

    function FtpNode(n) {
    RED.nodes.createNode(this, n);
   
    var node = this;
    console.log("NODE " +JSON.stringify(n));
    this.options = {
        'host': n.host || 'localhost',
        'port': n.port || 21,
        'secure': n.secure || false,
        'secureOptions': n.secureOptions,
        'user': n.user || 'anonymous',
        'password': n.password || 'anonymous@',
        'pass': n.password || 'anonymous@',
        'connTimeout': n.connTimeout || 10000,
        'pasvTimeout': n.pasvTimeout || 10000,
        'keepalive': n.keepalive || 10000
    };
    console.log("HOST"+this.options.host);
  }



  RED.nodes.registerType('ftp', FtpNode);

  function FtpInNode(n) {
   
    RED.nodes.createNode(this, n);
    
      var node = this;
      var standardJSON = {  items: [] };
     
      node.on('input', function (msg) {

        this.ftp = n.ftp;
        this.repository = msg.repository;
        this.operation = n.operation;
        this.filename = n.filename;
        this.localFilename = n.localFilename;
        this.workdir = n.workdir || './';
        this.savedir = n.savedir || './';
        var remotePath = "";
        var FTPworkdir =    this.workdir;
        var query = msg.query;
    
        if (msg.remotePath){
        remotePath = decode(msg.remotePath);
        }
        console.log("this.ftp " + JSON.stringify(n));
        console.log("FTP List workdir:" + this.workdir);
        console.log("FTP List absPath:" + remotePath);
        this.ftpConfig = RED.nodes.getNode(this.repository);
        var FTPHost = this.ftpConfig.options.host;
        var FTPPort = this.ftpConfig.options.port;
        if (this.ftpConfig) {
        console.log("this.ftpConfig: " + JSON.stringify(this.ftpConfig));
        try {
           

            
            var JSFtp = require("jsftp");
            JSFtp = require('jsftp-lsr')(JSFtp);   //Recursively get nested files with jsftp, like ls -R - see find-case
console.log(msg.operation);
            switch (msg.operation) {
                case 'list':
                var  Ftp = new JSFtp(node.ftpConfig.options);
            
               /*     var remotePath = "";
                    if (remotePath==""){
                        Path = "";    
                    }
                    else{
                        Path    =  decode(remotePath);
                    }*/
                    

                   // var parentPath  = Path.substr(0, Path.lastIndexOf("\/"));
                   var parentPath = ""

                    var folders = remotePath.split('/');
                    
                    
                    for (var i = 0; i < folders.length-1; i++) { 
                        if  (folders[i].trim() !==  "") {     
                        parentPath +=   "\/" + folders[i] 
                        }
                    };
                      
          
                    

                   

                    Ftp.ls(this.workdir + remotePath,function(err,data){
                    
                
                    var standardJSON = {    parent: encode(parentPath),  items: [] };
            //        parent: path2id(Path.substr(0, Path.lastIndexOf("\\"))),
              
                      if(data) {
                        data.forEach(function(resultItem, i) {
             
                            let objType = "";
                            switch( resultItem.type){
                                case 1: 
                                objType =  "folder"
                                break;
                                case 0: 
                                objType =  "file"
                                break;
                         

                       
                                
                            }
                            
                            standardJSON.items.push({
                                    id: encode(remotePath + "\/" + resultItem.name) ,
                                    name: resultItem.name,
                                    type: objType,
                                    size: resultItem.size,
                                    filename: resultItem.name,
                                    lastmod: resultItem.time,
                                    url: "ftp://" + FTPHost + ":" + FTPPort + "\/" + FTPworkdir + remotePath + "\/" + resultItem.name,
                                    mime:  mime.lookup(resultItem.name)
                           
                            });
     

                       });
                    }

                       console.log(JSON.stringify(standardJSON));
                       msg.payload = standardJSON;
                       node.send(msg);
                    }
                );
              

                

                    break;
               
              case 'get':
                    var Ftp = new JSFtp(node.ftpConfig.options);
             
                var fileName = remotePath.substring(remotePath.lastIndexOf("\/")+1); 
                
           
                    var absFileNamePath = this.workdir + remotePath;
                   console.log("File to Download :" +fileName)

                    Ftp.getGetSocket(absFileNamePath,  function(err, socket){
                        if (err) {
                            node.error(err);
                        }else{

                       
                            

                            msg.headers = {};
                   
                            msg.headers['Content-Disposition'] = 'attachment; filename='+ fileName //or inline for preview;  
                            
                          
                            msg.headers['Content-Type'] = mime.lookup(fileName)//"image/jpeg"; //contentType;

                       

                            var chunks = [];
                            var size = 0;
            
                            socket.on("data", function(chunk) {
                            //    pieces.push(d);
                                size += chunk.length;
                                chunks.push(chunk);
                               
                            });
                            socket.on('close', function() {
                                var data = bufferConcat(chunks, size);           
                                msg.payload = data;
                            //    msg.payload.filename = "Test.jpg";
                                node.send(msg);
                            });
              

                            socket.resume();
                        }
                    });
                    break;
                case 'put':
                    var d = new Date();
                    var guid = d.getTime().toString();

                    if (node.fileExtension == "") {
                        node.fileExtension = ".txt";
                    }
                    var newFile = node.workdir + guid + node.fileExtension;
                    var msgData = '';
                    if (msg.payload.filename)
                        newFile = msg.payload.filename;

                    if (msg.payload.filedata)
                        msgData = msg.payload.filedata;
                    else
                        msgData = JSON.stringify(msg.payload);

                    console.log("FTP Put:" + newFile);

                    var Ftp = new JSFtp(node.ftpConfig.options);

                    var buffer = new Buffer(msgData);

                    Ftp.put(buffer, newFile, function(err){
                        if (err)
                            node.error(err);
                        else{
                            node.status({});
                            msg.payload.filename = newFile;
                            node.send(msg);
                        }
                    });
                    break;
                case 'delete':
                    console.log("FTP Delete:" + msg.payload.filename);
                    var Ftp = new JSFtp(node.ftpConfig.options);
                    Ftp.raw("dele", msg.payload.filename, function(err, data) {
                        if (err) node.error(err);
                        else{
                            node.status({});
                            node.send(msg);
                        }
                    });
                    break;
                case 'find':
              
              
          //      console.log("FTP Find:" + msg.payload.filename);
                    var Ftp = new JSFtp(node.ftpConfig.options);
                    var remotePath = "";
                    if (remotePath==""){
                        remotePath = "";    
                    }
                    else{
                        remotePath    =  decode(remotePath);
                    }
                    console.log(node.workdir + remotePath)
                    console.log(query);
                    Ftp.lsr(node.workdir + remotePath , function (err, data) {

        
         //           console.log('File structure', JSON.stringify(data, null, 2));
                        if (err) {
                            console.log(err);
                         node.error(err);  
                        } 
                        else{
                            node.status({});

                            var standardJSON = {    parent: "",  items: [] };
                            //        parent: path2id(Path.substr(0, Path.lastIndexOf("\\"))),
                                
                        //var query = "Kill";
                        var searchField = "byName";


                                      if(data) {

                                            var numbers = new JefNode(data).filter(function(JSONnode) {
                                                switch (searchField){
                                                    case("byName"):
                                                        if (JSONnode.key == 'name') {
                                                           if  (JSONnode.value.toUpperCase().search(query.toUpperCase())>=0) {
                                                //               console.log("FOUND")
   

                                                         
                                                            var parentContainer = JSONnode.parent;

                                                            var relativePath = getFolderPath(parentContainer.path,data);
                                                           
                                                  //          console.log("Type:" + parentContainer.get('type').value);
                                                            let objType = "";
                                                            let ftpid = "";
                                                            switch( parentContainer.get('type').value){
                                                                case 1: 
                                                                objType =  "folder",
                                                                ftpid =  encode(node.workdir + relativePath) 
                                                                break;
                                                                case 0: 
                                                                objType =  "file",
                                                                ftpid = encode(node.workdir + relativePath  + "\/" + JSONnode.value) 
                                                                break;
                                                            }

                                                         console.log( "ftp://" + FTPHost + ":" + FTPPort + "\/" + node.workdir + relativePath  + "\/" + JSONnode.value);
                                                            
                                                            standardJSON.items.push({
                                                                id: ftpid,                                                  
                                                                name: JSONnode.value,
                                                                type: objType,
                                                                size: parentContainer.get('size').value,
                                                                filename: parentContainer.name,
                                                                lastmod: parentContainer.get('time').value,
                                                                url: "ftp://" + FTPHost + ":" + FTPPort + "\/" + node.workdir + relativePath  + "\/" + JSONnode.value,
                                                               mime:  mime.lookup(parentContainer.get('name').value)

                                                            })
                                                     //       console.log(JSONnode.value);
                                                        //    return parentContainer // + ' ' + node.value;
                                                           }
                                                        }

                                                    break;
                                                    case("size"):
                                                    break;
                                                }

                                                
                                                });

                                        console.log(JSON.stringify(standardJSON.items));
                                        msg.payload = standardJSON;
                                        node.send(msg);

                               /*         data.forEach(function(resultItem, i) {
                                     //       console.log(i)
                                             if(resultItem['name'].search(query)>=0) {
                                         //        console.log("Found")
                                                    let objType = "";
                                                    switch( resultItem.type){
                                                        case 1: 
                                                        objType =  "folder"
                                                        break;
                                                        case 2: 
                                                        objType =  "file"
                                                        break;
                                                
                        
                                            
                                                        
                                                    }
                        
                                            
                                                    
                                                    standardJSON.items.push({
                                                            id: (Path + "\/" + resultItem.name) ,
                                                            name: resultItem.name,
                                                            type: objType,
                                                            size: resultItem.size,
                                                            filename: resultItem.name,
                                                            lastmod: resultItem.time,
                                                            mime:  mime.lookup(resultItem.name)
                                                
                                                    });
                                        }
                         
                            msg.payload = standardJSON;
                        node.send(msg);
                        });*/
                    
                    }
                }
                })
         
                    
                break;
            }

      } catch (error) {
          console.log("Caught Error:" + error);
         node.error(error);
      }
    }
    else {
        this.error('missing ftp configuration');
      }
    });
    
    
  
}
RED.nodes.registerType('ftp in', FtpInNode);
}


function getFolderPath( propertyName, object ) {
    let relativePath = "";
    var parts = propertyName.split( "." ),
      length = parts.length,
      i,
      property = object || this;
  if (length==1) { //then it´s the root entry-Folder
    relativePath =  "\/";
   
  }
  else {
    
    for ( i = 0; i < length-2; i++ ) { //-2 to get into children\parentFolder 
  
     property = property[parts[i]]; 
      if (parts[i]!='children'){
        relativePath +=  "\/" + property.name
  
      }
    }
    }
return relativePath;
  }
