var qsocks = require('qsocks');
var fs = require('fs');
var request = require('request');
var js2xmlparser = require('js2xmlparser');
var Promise = require("promise");

module.exports={
  getLibMeasures: function(conn_data, global, cookies, single_app){
    //Creating the promise for the Applications Library Measures
    //Root admin privileges should allow him to access to all available applications. Otherwise check your environment's security rules for the designed user.
    var promise_lib_msr = new Promise(function(resolve){

      console.log();
      console.log("*****************************************************");
      console.log("          Loading the Library Measures List          ");
      console.log("*****************************************************");

      //Loading a list of all the available documents
      if(single_app)
        getAppLibraryMeasures([conn_data.single_app_id]);
      else{
        global.getDocList().then(function(documents) {
          var available_docs = [];
          documents.forEach(function(document_entry){
            available_docs.push(document_entry.qDocId);
          });

          console.log("Processing each document");
          getAppLibraryMeasures(available_docs);
        })
      }

      //Loading library measures from all the documents, one at the time
      function getAppLibraryMeasures(document_list){
        console.log();
        console.log("──────────────────────────────────────");
        var first_app = document_list.shift();
        console.log(" "+first_app);
        console.log("──────────────────────────────────────");

        //Configurations to open the first document (based on mindspank's https://github.com/mindspank/qsocks examples)
        var o = 'http://'+conn_data.origin;

        var config_app = {
          host: conn_data.server_address,
          isSecure: true,
          origin: o,
          rejectUnauthorized: false,
          appname: first_app,
          headers: {
            "Content-Type": "application/json",
            "Cookie": cookies[0]
          }
        }

        //Scoped connection for the document
        qsocks.Connect(config_app).then(function(global) {
          global.openDoc(config_app.appname).then(function(app) {
            //Checking for the document's contents and focusing on the measures
            app.getAllInfos().then(function(appInfos){
              var measures_list = [];
              appInfos.qInfos.forEach(function(document_infos){
                if(document_infos.qType=='measure'){
                  measures_list.push(document_infos.qId)
                }
              })

              console.log(" Loading measures details:");

              //Verifying if the document has library measures
              if(measures_list.length>0)
                getMeasuresDetails(measures_list);
              else if(measures_list.length==0 && document_list.length>0){
                console.log();
                console.log(" Loaded all measures. Jumping to next application.");
                console.log(" Remaining applications: " + document_list.length);
                getAppLibraryMeasures(document_list);
              }
              else if(measures_list.length==0 && document_list.length==0){ //checking if all measures and documents were processed
                console.log("──────────────────────────────────────");
                resolve("Checkpoint: Applications Library Measures are loaded");
              }
              else{
                console.log("──────────────────────────────────────");
                console.log ("Shouldn't be here, something went wrong...");
                process.exit();
              }

              //Loading the library measures of the document, one library measure at the time
              function getMeasuresDetails(measures_list){
                var first_measure = measures_list.shift();
                console.log();
                console.log(" Measure id: "+first_measure);

                app.getMeasure(first_measure).then(function(msr){
                  //Loading the measure's layout properties
                  msr.getLayout().then(function(msr_layout){
                    return msr_layout;
                  })
                  .then(function(msr_layout){
                    msr.getLinkedObjects().then(function(msr_lnk){
                      //Loading the measure's linked objects
                      var msr_props = {msr_layout,msr_lnk}
                      return msr_props;
                    })
                    .then(function(data){
                      //Setting up options for XML file storage
                      var options = {
                        useCDATA: true
                      };

                      //Storing XML with the measure's data
                      var xml_library_measures = js2xmlparser("libraryMeasures", data, options);
                      fs.writeFile('AppStructures/'+config_app.appname+'_LibraryMeasures_'+first_measure+'.xml', xml_library_measures, function(err) {
                        if (err) throw err;
                        console.log('   '+config_app.appname+'_LibraryMeasures_'+first_measure+'.xml file saved');
                        console.log();
                        console.log("   Updating the remaining measures list");
                        console.log("   This is the measures list length: "+measures_list.length);
                        //Checking if all library measures were processed
                        if(measures_list.length>0)
                          getMeasuresDetails(measures_list);
                        else if (measures_list.length==0 && document_list.length>0){
                          console.log();
                          console.log(" Loaded all measures. Jumping to next application.");
                          console.log(" Remaining applications: " + document_list.length);
                          getAppLibraryMeasures(document_list);
                        }
                        else if (measures_list.length==0 && document_list==0){ //checking if all measures and documents were processed
                          console.log("──────────────────────────────────────");
                          resolve("Checkpoint: Applications Library Measures are loaded");
                        } 
                        else {
                          console.log("──────────────────────────────────────");
                          console.log ("Shouldn't be here, something went wrong...");
                          process.exit();
                        }
                      })
                    })
                  })
                })
              }//getMeasuresDetails
            })
          })
        })
      }//getAppLibraryMeasures
    })//promise
    return promise_lib_msr;
  }//getLibMeasures
}//module