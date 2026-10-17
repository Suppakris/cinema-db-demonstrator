/**
 * Created by Dell on 1/31/2020.
 */function addSeat(seat_id) {
    $("#"+seat_id).removeClass("voucher_selected");
  
    var seat_type = $("#"+seat_id).attr("data-seat-type");
    if(seat_type == 'IMAX VR Extra 2Player' || seat_type == 'MGen VR Extra 2Player' ){
        var flag = 'notcheck';
    }else{
        var flag = 'check';
    }

    if(flag == 'notcheck'){
        if($("#" + seat_id).hasClass("btn-success")){
            $("#seatPlan").find("a.seat-movie").removeClass("btn-success");
        }else{
            $("#seatPlan").find("a.seat-movie").addClass("btn-success");
        }
    }

    //check maximum booking
    if(flag == 'check') { //if imax vr theatre 3 ->>not check
        if(check_limit_exseed()=="addseat" || $("#"+seat_id).hasClass("btn-success")){
            //เช็คที่นั่งแถวเดียวกัน
            var data_seat_choose = $("#"+seat_id).attr("data-seat");
            var _seat_array_choose = data_seat_choose.split('|');
            var here_seat_group_type = $("#"+seat_id).attr("data-seat-group-type");
            var pair_count = 0;
            var triple_count = 0; // เพิ่มตัวแปรสำหรับนับที่นั่งกลุ่ม 3 ที่นั่ง
            
            //============ VR ===============
            var data_seat_type = $("#"+seat_id).attr("data-seat-type");
            var flag_seat_vr = 'false';
            var seat_type_lower = data_seat_type.toLowerCase();
            if (seat_type_lower.indexOf("vr") >= 0){
                flag_seat_vr = 'true';
            }
            //===============================

            //เช็คว่าเป็นการเลือกหรือถอดออก
            if($("#"+seat_id).hasClass("btn-success")){
                var flag_pair = 'out';
            }else{
                var flag_pair = 'in';
            }

            // นับจำนวนที่นั่งแต่ละประเภทที่เลือกอยู่
            $('.btn-success').each(function(){
                var seat_group_type = $(this).attr("data-seat-group-type");
                if(seat_group_type == "pair"){
                    pair_count = parseInt(pair_count) + 1;
                } else if(seat_group_type == "triple") { // เพิ่มเงื่อนไขสำหรับที่นั่ง triple
                    triple_count = parseInt(triple_count) + 1;
                }
            });

            // เช็คเงื่อนไขการเลือกที่นั่ง
            var can_select = true;
            
            // กรณีที่นั่งคู่ - จำกัด 1 คู่/ครั้ง
            if(pair_count >= 2 && here_seat_group_type == 'pair' && flag_pair == 'in' && flag_seat_vr == 'false'){
                alert("สามารถทำรายการเลือกที่นั่งได้ 1คู่/ครั้ง เท่านั้น");
                can_select = false;
            }
            
            // กรณีที่นั่ง 3 ที่นั่ง - จำกัด 1 กลุ่ม/ครั้ง
            else if(triple_count >= 3 && here_seat_group_type == 'triple' && flag_pair == 'in' && flag_seat_vr == 'false'){
                alert("สามารถทำรายการเลือกที่นั่งกลุ่ม 3 ที่นั่งได้ 1กลุ่ม/ครั้ง เท่านั้น");
                can_select = false;
            }
            
            // เช็คห้ามเลือกที่นั่งคู่พร้อมกับที่นั่ง 3 ที่นั่ง
            else if(triple_count > 0 && here_seat_group_type == 'pair' && flag_pair == 'in') {
                alert("ไม่สามารถเลือกที่นั่งคู่พร้อมกับที่นั่งกลุ่ม 3 ที่นั่งได้");
                can_select = false;
            }
            
            // เช็คห้ามเลือกที่นั่ง 3 ที่นั่งพร้อมกับที่นั่งคู่
            else if(pair_count > 0 && here_seat_group_type == 'triple' && flag_pair == 'in') {
                alert("ไม่สามารถเลือกที่นั่งกลุ่ม 3 ที่นั่งพร้อมกับที่นั่งคู่ได้");
                can_select = false;
            }

            if(can_select) {
                $("#"+seat_id).toggleClass('btn-default btn-success');
                var data_seat_group = $("#"+seat_id).attr("data-seat-id-group");

                if($("#"+seat_id).hasClass("btn-success")){
                    var flag_choose = "yes";
                    check_seat_group(data_seat_group,'yes');
                }else{
                    var flag_choose = "no";
                    check_seat_group(data_seat_group,'no');
                }
                window.seatsId = seat_id;
            }
        }else{
            if(window.language == 'en'){
                alert('Limit Exceed');
            }else{
                alert('คุณเลือกครบ 6 ที่นั่งเรียบร้อยแล้ว!');
            }
        }
    }//end of flagcheck

    var is_odd = false;
    $('.btn-success').each(function() {
        var data_seat = $(this).attr("data-seat");

        //============ VR ===============
        var data_seat_type = $(this).attr("data-seat-type");
        var flag_seat_vr = 'false';
        var seat_type_lower = data_seat_type.toLowerCase();
        if (seat_type_lower.indexOf("vr") >= 0){
            flag_seat_vr = 'true';
        }
        //===============================
        console.log('checking::'+data_seat);
    }).promise().done(function(){
        if(is_odd == true){
            $(".summary_plan").css({"display":"none"});
        }else{
            $(".summary_plan").css({"display":"block"});
            check_reserve_click_seat();
        }

        $(".book_payment_load").html('');
        $(".book_payment").hide();

        $("#promotion").hide();
        $(".movie_select_detail").hide();
        $("div.book_seat_price_summary").show();

        seat_shopping_inside();

        //------------------------ stop time ------------------
        $("ul.stepNav li").removeClass("selected");
        $("li#stepNav_two").addClass("selected");

        $('div#clock').countdown('stop');
        $("div#clock").html("");
        $("div#panel_clock").hide();
    });
}

// ปรับปรุงฟังก์ชัน check_seat_group เพื่อรองรับที่นั่ง 3 ที่นั่ง
function check_seat_group(seat_group_data, flag_select){
    if(seat_group_data != ""){
        if(flag_select == 'yes'){
            // ผู้ซื้อกดเลือกที่นั่งกลุ่มมาจะเลือกที่นั่งอันข้างๆไปด้วย
            var each_seat_id = seat_group_data.split("#");
            $.each(each_seat_id, function(id, val){
                if(val != ""){
                    var each_row_id = val.split("-");
                    var seat_id = $("a[data-row-name="+each_row_id[0]+"][data-seat-id="+each_row_id[1]+"]").attr("id");
                    if($("#"+seat_id).hasClass("btn-success")){
                        // อันที่เลือกที่ check ไปแล้ว
                    }else{
                        // อันข้างๆ ที่ยังไม่ได้ check
                        // ใช้ toggleClass แทน addSeat เพื่อหลีกเลี่ยง recursive
                        $("#"+seat_id).toggleClass('btn-default btn-success');
                    }
                }
            });
        }else{
            // uncheck
            var each_seat_id = seat_group_data.split("#");
            $.each(each_seat_id, function(id, val){
                if(val != ""){
                    var each_row_id = val.split("-");
                    var seat_id = $("a[data-row-name="+each_row_id[0]+"][data-seat-id="+each_row_id[1]+"]").attr("id");
                    if($("#"+seat_id).hasClass("btn-success")){
                        // อันข้างๆ ที่ยังไม่ได้ uncheck
                        // ใช้ toggleClass แทน addSeat เพื่อหลีกเลี่ยง recursive
                        $("#"+seat_id).toggleClass('btn-default btn-success');
                    }
                }
            });
        }
    }
}

// ปรับปรุงฟังก์ชัน check_limit_exseed เพื่อรองรับที่นั่ง 3 ที่นั่ง
function check_limit_exseed(){
    // กำหนดค่าตามนี้
    var single_count = 1;
    var pair_count = 0;
    var triple_count = 0; // เพิ่มตัวแปรสำหรับนับที่นั่งกลุ่ม 3 ที่นั่ง

    // วนหาเก้าอี้ที่จองแล้ว
    $('.btn-success').each(function(){
        var seat_group_type = $(this).attr("data-seat-group-type");
        
        if(seat_group_type == "single"){
            single_count = parseInt(single_count) + 1;
        }else if(seat_group_type == "pair"){
            pair_count = parseInt(pair_count) + 1;
        }else if(seat_group_type == "triple"){ // เพิ่มเงื่อนไขสำหรับที่นั่ง triple
            triple_count = parseInt(triple_count) + 1;
        }
    });

    // คำนวณจำนวนที่นั่งที่เลือก
    // ถ้าเป็นที่นั่งคู่ จะนับเป็น 1 ที่ เมื่อเลือกครบ 2 ที่ (pair_count / 2)
    // ถ้าเป็นที่นั่ง 3 ที่นั่ง จะนับเป็น 1 ที่ เมื่อเลือกครบ 3 ที่ (triple_count / 3)
    var sum_success = parseInt(single_count);
    
    if(pair_count > 0 && pair_count % 2 == 0){
        sum_success += parseInt(pair_count / 2);
    }
    
    if(triple_count > 0 && triple_count % 3 == 0){
        sum_success += parseInt(triple_count / 3);
    }

    // ถ้ายังน้อยกว่าเท่ากับ 6 จะให้จองได้ แต่ถ้ามากกว่านั้นจะไม่ให้จอง
    if(sum_success <= 6){
        return "addseat";
    }else{
        return "notaddseat";
    }
}

// ปรับปรุงฟังก์ชัน seat_shopping_inside เพื่อรองรับการคำนวณราคาของที่นั่ง 3 ที่นั่ง
function seat_shopping_inside(){
    if($('.btn-success').length > 0){
        // ถ้ามีเก้าอี้ที่เลือก
        var str_format = "";
        var str_only_id = "";
        var str_seat_payment = "";
        var count = 1;
        var selectedSeats = '';
        var pairSeat = '';
        var tripleSeat = ''; // เพิ่มตัวแปรสำหรับที่นั่ง 3 ที่นั่ง
        var price_not_login_sum = 0;

        $(".btn-success").each(function(){
            var row_name = $(this).attr("data-row-name");
            var price = $(this).attr("data-price");
            var price_not_login = $(this).attr("data-price-not-login");
            var position = $(this).attr("data-seat-id");
            var type_seat = $(this).attr("data-seat-type");
            var type_img = $(this).attr("data-type_img");
            var type_not_login = $(this).attr("data-type-not-login");
            var area_code = $(this).attr("data-areacat");
            var seat_group_type = $(this).attr("data-seat-group-type");
            
            // เพิ่มข้อมูลราคากลุ่มสำหรับที่นั่ง 3 ที่นั่ง
            var group_full_price = $(this).attr("data-group-full-price") || "0";
            var group_full_price_not_login = $(this).attr("data-group-full-price-not-login") || "0";
            
            str_format += row_name+"|"+ price+"|"+position+"|"+type_seat+"|"+type_img+"|"+price_not_login+"|"+type_not_login+"|"+area_code+"|"+seat_group_type+"|"+group_full_price+"|"+group_full_price_not_login+"#";

            var seat = $(this).attr("data-seat");
            str_only_id += seat+"#";

            if(!jQuery(this).hasClass('Group')) {
                if(selectedSeats == '')
                    selectedSeats = 'seat_' + count + '=' + $(this).attr("data-seat");
                else
                    selectedSeats = selectedSeats + '&' + 'seat_' + count + '=' + $(this).attr("data-seat");
            }

            if(jQuery(this).hasClass('Group') && seat_group_type == "pair") {
                if(pairSeat == '')
                    pairSeat = '&pair_seat_' + count + '=' + $(this).attr("data-seat");
                else
                    pairSeat = pairSeat + '&' + 'pair_seat_' + count + '=' + $(this).attr("data-seat");
            }
            
            // เพิ่มการจัดการที่นั่ง 3 ที่นั่ง
            if(jQuery(this).hasClass('Group') && seat_group_type == "triple") {
                if(tripleSeat == '')
                    tripleSeat = '&triple_seat_' + count + '=' + $(this).attr("data-seat");
                else
                    tripleSeat = tripleSeat + '&' + 'triple_seat_' + count + '=' + $(this).attr("data-seat");
            }
            count++;
        });
        
        var host = window.location.protocol + '//' + window.location.host+"/";

        console.log(str_only_id);
        var dataSet = {
            'str_format': str_format,
            'str_only_id': str_only_id,
            'pairSeat': pairSeat,
            'tripleSeat': tripleSeat, // เพิ่มข้อมูลที่นั่ง 3 ที่นั่ง
            'selectedSeats': selectedSeats
        }

        console.log(dataSet);

        $.ajax({
            type: "POST",
            data: dataSet,
            url: host+"booking2/ajax_seating_list",
            cache: false,
            success: function(response){
                $(".book_seat_price_summary").show();
                $("div.book_seat_price_summary").html(response); // สรุปที่นั่ง
                var sumprice = $(document).find("input[name=sumprice]").val();
                $("input[name=totalPrice]").val(sumprice);
            }
        });
    } else {
        // เคลียร์ด้านขวาให้หมด ถ้าไม่มี selected
        $("div.summary_plan").css({"display":"none"});
        $(".book_seat_price_summary").html(""); // ลบข้อมูล summary
        $(".book_seat_price_summary").hide();
    }
}

function check_reserve_click_seat(){
    var check_reserve = 1;
    //เขียนเพิ่มต้องเช็คเพิ่มว่า มี btn-sucess รึยัง
    if($('.btn-success').length > 0){
        //หาว่าเป็นที่นั่งตัว R รึเปล่า
        $(document).find(".btn-success").each(function() {
            var flag_reserve = $(this).attr("data-reserve");
            if(flag_reserve!="rs"){
                //click seat that not contain R
                check_reserve = 0;
                $(document).find("button#reserve").addClass("reserve_disabled");
            }
        });
        if(check_reserve==1){
            //ถ้าผ่านหมด จาก เข้าฟังก์ชันจอง
            $(document).find("button#reserve").removeClass("reserve_disabled");
        }
    }
}


function alert_error(text_error){
    $("body").css({"position":"relative"});
    $("div#erroraction p").text(text_error);
    $("div#erroraction").show();
}
