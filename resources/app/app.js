const {dialog,shell} = require('electron').remote;


$(function () {

    let state = {
        settings:{},
        keys:false
    };

    //handle tabs action
    $('.tabgroup > div').hide();
    // loadTab($('.tabgroup > div:first-of-type'));

    // This will wait for the astilectron namespace to be ready
    document.addEventListener('astilectron-ready', function () {
        let sendMessage = function (name, payload, callback) {
            astilectron.sendMessage({name: name, payload: payload}, callback)
        };

        sendMessage("loadSettings", "", function (message) {
            state.settings = JSON.parse(message);
        });

        sendMessage("isKeysFileAvailable", "", function (message) {
            state.keys = message
        });

        sendMessage("checkUpdate", "", function (message) {
            if (message === "false"){
                return
            }
            dialog.showMessageBox(null, {
                type: 'info',
                buttons: ['Ok'],
                defaultId: 0,
                title: 'New update available',
                message: 'There is a new update available, please download from Github',
                detail: message.payload
            });
        });

        $(".progress-container").show();
        $(".progress-type").text("Downloading latest Switch titles/versions ...");

        sendMessage("updateDB", "", function (message) {
            scanLocalFolder();
        });

        astilectron.onMessage(function (message) {
            // Process message
            // console.log(message)
            let pcg = 0
            if (message.name === "updateProgress") {
                let pp = JSON.parse(message.payload);
                let count = pp.curr;
                let total = pp.total;
                $('.progress-msg').text(pp.message + " ...");
                if (count !== -1 && total !== -1){
                    pcg = Math.floor(count / total * 100);
                    $('.progress-bar').attr('aria-valuenow', pcg);
                    $('.progress-bar').attr('style', 'width:' + Number(pcg) + '%');
                    $('.progress-bar').text(pcg + "%");
                }
                if (pcg === 100){
                    $(".progress-container").hide();
                }else{
                    $(".progress-container").show();
                }
            }
            else if (message.name === "libraryLoaded") {
                state.library = JSON.parse(message.payload);
                loadTab("#library")
            }
            else if (message.name === "error") {
                dialog.showMessageBox(null, {
                    type: 'error',
                    buttons: ['Ok'],
                    defaultId: 0,
                    title: 'Error',
                    message: 'An unexpected error occurred',
                    detail: message.payload
                });
                state.settings.folder = undefined;
                $(".progress-container").hide();
                loadTab("#library")
            }
        });

        let openFolderPicker = function (mode) {
            //show info
            dialog.showOpenDialog({
                properties: ['openDirectory'],
                message:"Select games folder"
            }).then(partial(updateFolder,mode))
                .catch(error => console.log(error))
        };

        let scanLocalFolder = function(){
            if (!state.settings.folder){
                loadTab("#library")
                return
            }
            //show progress
            $(".progress-container").show();
            $(".progress-type").text("Scanning local library...");

            sendMessage("updateLocalLibrary", "", (r => {}))
        };

        let updateFolder = function (mode,result) {
            if (result.canceled) {
                console.log("user aborted");
                return
            }
            if (!result.filePaths || !result.filePaths.length){
                return
            }

            if (mode === "add"){
                state.settings.scan_folders = state.settings.scan_folders || []
                if (!state.settings.scan_folders.includes(result.filePaths[0])){
                    state.settings.scan_folders.push(result.filePaths[0]);
                }else{
                    return;
                }

            }else{
                state.settings.folder = result.filePaths[0];
            }
            $('.tabgroup > div').hide();
            console.log("selected folder:"+result.filePaths[0]);
            state.library = undefined;
            state.updates = undefined;
            state.dlc = undefined;
            sendMessage("saveSettings", JSON.stringify(state.settings), scanLocalFolder);
        };

        function loadTab(target) {
            $(target).show();
            if (target === "#settings") {
                let settingsJSON = JSON.stringify(state.settings, null, 2)
                let settingsHtml = $(target + "Template").render({code: settingsJSON})
                $(target).html(settingsHtml);
                //  asticode.loader.hide()
            } else if (target === "#organize") {
                let html = $(target + "Template").render({folder: state.settings.folder,settings:state.settings})
                $(target).html(html);
            } else if (target === "#updates") {
                if (state.settings.folder && !state.library){
                    return
                }
                if (state.library && !state.updates){
                    sendMessage("missingUpdates", "", (r => {
                        state.updates = JSON.parse(r)
                        loadTab("#updates")
                    }));
                    return
                }
                let html = $(target + "Template").render({folder: state.settings.folder,updates:state.updates})
                $(target).html(html);
                if (state.updates && state.updates.length) {
                    let table = new Tabulator("#updates-table", {
                        layout:"fitDataStretch",
                        pagination: "local",
                        paginationSize: state.settings.gui_page_size,
                        data: state.updates,
                        columns: [
                            {formatter:"rownum"},
                            {field: "Attributes.bannerUrl",formatter:"image", headerSort:false,formatterParams:{height:"60px", width:"60px"}},
                            {title: "Title", field: "Attributes.name", headerFilter:"input",formatter:"textarea",width:350},
                            {title: "Type", field: "Meta.type", headerFilter:"input"},
                            {title: "Title id", headerSort:false, field: "Attributes.id", hozAlign: "right", sorter: "number"},
                            {title: "Local version", headerSort:false, field: "local_update", hozAlign: "right", sorter: "number"},
                            {title: "Available version", headerSort:false, field: "latest_update", hozAlign: "right"},
                            {title: "Update date", headerSort:true, field: "latest_update_date",sorter:"date", sorterParams:{format:"YY-MM-DD"}}
                        ],
                    });
                }
            } else if (target === "#dlc") {
                if (state.settings.folder && !state.library){
                    return
                }
                if (state.library && !state.dlc){
                    sendMessage("missingDlc", "", (r => {
                        state.dlc = JSON.parse(r)
                        loadTab("#dlc")
                    }));
                    return
                }
                let html = $(target + "Template").render({folder: state.settings.folder,dlc:state.dlc});
                $(target).html(html);
                if (state.dlc && state.dlc.length) {
                    let table = new Tabulator("#dlc-table", {
                        layout:"fitDataStretch",
                        pagination: "local",
                        paginationSize: state.settings.gui_page_size,
                        data: state.dlc,
                        columns: [
                            {formatter:"rownum"},
                            {field: "Attributes.bannerUrl",formatter:"image", headerSort:false,formatterParams:{height:"60px", width:"60px"}},
                            {title: "Title", field: "Attributes.name", headerFilter:"input",formatter:"textarea",width:350},
                            {title: "# Missing", field: "missing_dlc.length"},
                            {title: "Missing DLC", headerSort:false, field: "missing_dlc",formatter:function(cell, formatterParams, onRendered){
                                    value = ""
                                    for (var i in cell.getValue())
                                    {
                                        value +="<div>"+cell.getValue()[i]+"</div>"
                                    }
                                    return value
                                }}
                        ],
                    });
                }
            } else if (target === "#status") {
                if (state.settings.folder && !state.library){
                    return
                }
                let html = $(target + "Template").render({folder: state.settings.folder,library:state.library ? state.library.issues: undefined,numFiles:state.library ? state.library.num_files:-1});
                $(target).html(html);
                if (state.library.issues && state.library.issues.length) {
                    let table = new Tabulator("#status-table", {
                        layout:"fitDataStretch",
                        pagination: "local",
                        paginationSize: state.settings.gui_page_size,
                        data: state.library.issues,
                        columns: [
                            {formatter:"rownum"},
                            {title: "File name",width:500, headerSort:false, field: "key",formatter:"textarea",cellClick:function(e, cell){
                                    //e - the click event object
                                    //cell - cell component
                                    shell.showItemInFolder(cell.getData().key)
                                }
                            },
                            {title: "Issue", field: "value",width:350}
                        ],
                    });
                }
            }else if (target === "#library") {
                if (state.settings.folder && !state.library){
                    return
                }
                let html = $(target + "Template").render({folder: state.settings.folder,library:state.library ?state.library.library_data : undefined,keys:state.keys,scanFolders:state.settings.scan_folders})
                $(target).html(html);
                if (state.library && state.library.library_data.length) {
                    var table = new Tabulator("#library-table", {
                        layout:"fitDataStretch",
                        pagination: "local",
                        paginationSize: state.settings.gui_page_size,
                        data: state.library.library_data,
                        columns: [
                            {formatter:"rownum"},
                            {field: "icon",formatter:"image", headerSort:false,formatterParams:{height:"60px", width:"60px"}},
                            {title: "Title", field: "name", headerFilter:"input",formatter:"textarea",width:350},
                            {title: "Title id", headerSort:false, field: "titleId"},
                            {title: "Multi content", headerSort:false, field: "multi_content"},
                            {title: "Latest update", headerSort:false, field: "update"},
                            {title: "File name", headerSort:false, field: "path",formatter:"textarea",cellClick:function(e, cell){
                                    //e - the click event object
                                    //cell - cell component
                                    shell.showItemInFolder(cell.getData().path)
                                }
                            }
                        ],
                    });
                }
            }
        }

        $("body").on("click", ".folder-set", e => {
            openFolderPicker(e.target.textContent)
        });

        $("body").on("click", ".library-organize-action", e => {
            e.preventDefault();
            if (state.settings.organize_options.create_folder_per_game === false &&
                state.settings.organize_options.rename_files === false){
                dialog.showMessageBox(null, {
                    type: 'info',
                    buttons: ['Ok'],
                    defaultId: 0,
                    title: 'Library organization is turned off',
                    message: 'Please update settings.json to enable this feature',
                    detail: "You should set 'rename_files' and/or 'create_folder_per_game' to 'true' "
                });
                return
            }
            const options = {
                type: 'warning',
                buttons: ['Yes', 'No'],
                defaultId: 0,
                title: 'Confirmation',
                message: 'Are you sure you want to begin library organization?',
                detail: 'This action will modify your local library files',
            };

            dialog.showMessageBox(null, options).then( (r) => {

                if (r.response === 0) {
                    //show progress
                    $('.tabgroup > div').hide();
                    $(".progress-container").show();
                    $(".progress-type").text("Organizing local library...");

                    sendMessage("organize", "", (r => {
                        $(".progress-container").hide();
                        loadTab("#organize");
                        dialog.showMessageBox(null, {
                            type: 'info',
                            buttons: ['Ok'],
                            defaultId: 0,
                            title: 'Success',
                            message: 'Operation completed successfully'
                        })
                    }))
                }
            });

        });

        $('.tabs a').click(function (e) {
            e.preventDefault();
            let $this = $(e.currentTarget);
            let tabgroup = '#' + $this.parents('.tabs').data('tabgroup');
            let others = $this.closest('li').siblings().children('a');
            let target = $this.attr('href');
            others.removeClass('active');
            $this.addClass('active');
            $(tabgroup).children('div').hide();
            loadTab(target)
        });

        function partial(func /*, 0..n args */) {
            var args = Array.prototype.slice.call(arguments, 1);
            return function() {
                var allArguments = args.concat(Array.prototype.slice.call(arguments));
                return func.apply(this, allArguments);
            };
        }
    })

});