const express = require ("express");
const app = express();
/* Paquete de encriptación */
const bcryptjs = require("bcryptjs");

app.use(express.urlencoded({extended:false}));
app.use(express.json());

/* Configuro las variables de entorno */
const dotenv = require("dotenv");
dotenv.config({path:"./env/.env"})

/* Configuro el uso de la carpeta public, express detecta "/resource" para los archivos estaticos
   __dirname te da el path actual del proyecto */
app.use("/resources",express.static("public"));
app.use("/resources",express.static(__dirname + "/public/css"));

/* Seteamos el motor de renderizado */ 
app.set("view engine","ejs");

/* Configurando el express-session  para guardar las contraseñas */
const session = require("express-session");
app.use(session({
    secret:"secret",
    resave:true,
    saveUninitialized:true
}));

/* Configuro la base de datos */
const connection = require("./database/db");
const { connect } = require("./database/db");

/* CONFIGURO LA RUTA MADRE */
app.get("/",(req,res) => {
    cbuGenerator();
    res.render("index");
});

/* Ruta de login */
app.get("/login",(req,res) =>{
    res.render("login");
});

/* Autenticación de inicio de sesion con variables de sesion */
app.post("/auth",async (req,res) =>{
    console.log(req.body);
    connection.query("SELECT * FROM `usuarios` WHERE `userName` = ?",[req.body.userName],
    async (err,results) =>{
        try{
            if(results.length == 0 || !(await bcryptjs.compare(req.body.pass, results[0].pass))){
                res.render("login",{
                    alert:true,
                    alertTitle:"Inicio de sesión fallido",
                    alertMessage:"Nombre de usuario y/o Contraseña incorrectos",
                    alertIcon:"error",
                    showConfirmButton:true,
                    timer:0,
                    ruta:"login"
                });
                console.log("ocurrio un error");
            }else{
                console.log("Todo funciono bien");
                req.session.logged = true;
                req.session.userName = results[0].userName;
                req.session.balance = results[0].balance;
                req.session.cbu = results[0].cbu;
                res.render("login",{
                    alert:true,
                    alertTitle:"Inicio de sesión exitoso",
                    alertMessage:"Se inicio sesión correctamente!",
                    alertIcon:"success",
                    showConfirmButton:false,
                    timer:1500,
                    ruta:"home"
                });
            };
        }catch{
            res.render("login",{
                alert:true,
                alertTitle:"Inicio de sesión fallido",
                alertMessage:"Nombre de usuario y/o Contraseña incorrectos",
                alertIcon:"error",
                showConfirmButton:true,
                timer:0,
                ruta:"login"
            });
            console.log("Ocurrio un error fuera del try");
        }
    });
});

/* Ruta de registro */
app.get("/registro",(req,res) =>{
    res.render("registro");
});

/* Codificación de la contraseña e insersión de nuevos usuarios en la base de datos */
app.post("/registro",async (req,res)=>{
    const userInfo = {
        userName: req.body.userName,
        fullName: req.body.fullName,
        pass: req.body.pass
    };

    /* Verifica que las contraseñas sean iguales */
    if(userInfo.pass != req.body.confirmPass){
        res.render("registro",{
                alert:true,
                alertTitle:"Contraseñas",
                alertMessage:"Lo lamento, las contraseñas no coinciden",
                alertIcon:"error",
                showConfirmButton:true,
                timer:0,
                ruta:"registro"
        });
        return;
    };
    connection.query("SELECT * FROM `usuarios` WHERE `userName`= ?",[userInfo.userName],
     async (err,results) => {
        if(err){
            console.log("Ah ocurrido un error");
            return;
        }
        if(results.length != 0){
            res.render("registro",{
                alert:true,
                alertTitle:"Nombre de usuario",
                alertMessage:"Lo lamento, nombre de usuario ya en uso",
                alertIcon:"error",
                showConfirmButton:true,
                timer:0,
                ruta:"registro"
            });
            return;
        }
        /* Codifica la contraseña */
        let hashedPass = await bcryptjs.hash(userInfo.pass,8);
        /* Genera un cbu unico */
        let cbu = cbuGenerator();

        /* Agrega el nuevo usuario a la base de datos */
        connection.query("INSERT INTO `usuarios` SET ?",{
            userName: userInfo.userName,
            fullName: userInfo.fullName,
            pass: hashedPass,
            cbu: cbu
        }, async (err,results)=>{
            if(err){
                res.render("registro",{
                    alert:true,
                    alertTitle:"Registro fallido",
                    alertMessage:"Ah ocurrido un error, vuelvalo a intentar mas tarde",
                    alertIcon:"error",
                    showConfirmButton:true,
                    timer:0,
                    ruta:""
                });
                console.log("el error fue:",err);
                return;
            }
            res.render("registro",{
                alert:true,
                alertTitle:"Registro exitoso",
                alertMessage:"Se pudo registrar su cuenta!",
                alertIcon:"success",
                showConfirmButton:false,
                timer:1500,
                ruta:"home"
            });
            
        });
    });

});

/* Ruta home */
app.get("/home",(req,res) =>{
    res.render("home",{
        logged: req.session.logged,
        userName: req.session.userName,
        balance:req.session.balance,
        cbu:req.session.cbu,
        alert:req.session.alert,
        alertMoney:false,
    });
});

/* Ruta para ingresar dinero a la cuenta */
app.post("/money",(req,res) => {
    let addedAmount = req.body.amount;
    connection.query("SELECT `balance` FROM `usuarios` WHERE `userName` = ?",[req.session.userName],
    async (err,results) =>{
        if (err){
            console.log("A ocurrido un error en encontrar el balance",err);
            return;
        }
        console.log(results);
        if(req.session.logged){
            let newAmount = results[0].balance + parseInt(addedAmount);
            connection.query("UPDATE `usuarios` SET `balance` = ? WHERE `userName` = ? ",[newAmount,req.session.userName],
            (err,results) => {
                if(err){
                    console.log("Ocurrdo un error actualizando el balance",err);
                    return;
                }
                console.log("Los result fueron:",results);
                res.render("home",{
                    logged:req.session.logged,
                    userName:req.session.userName,
                    balance: newAmount,
                    cbu: req.session.cbu,
                    alert:false,
                    alertMoney:true
                });

            });
        }
    });
    
});

/*  Ruta para tranferir dinero entre usuarios */
app.post("/transfer",(req,res) => {
    /* Incluyo todos los datos en un objeto */
    const userToSend = {
        cbu: req.body.transferId,
        amount: req.body.transferAmount
    }
    console.log("Los datos enviados son los siguientes:",userToSend)
    connection.query("SELECT * FROM `usuarios` WHERE `cbu` = ?",[userToSend.cbu],
    (err,results) =>{
        if(err){
            console.log("Ocurrió un error",err);
            return;
        }
        if(results.length == 0){
            console.log("No existe usuario con ese CVU");
            res.render("home",{
                alert:true,
                logged: req.session.logged,
                userName: req.session.userName,
                balance:req.session.balance,
                cbu:req.session.cbu,
                ruta:"home"
            });
            return;
        }
        console.log("Los datos son:",results[0]);
        res.render("transferConfirm",{
            userName: results[0].userName,
            fullName: results[0].fullName,
            cbu: results[0].cbu,
            amountToSend: userToSend.amount,
            actualAmount: req.session.balance,
            alert:false
        });
        
    });
});

/* Ruta para confirmar la transferencia de dinero */
app.post("/transferConfirm", async(req,res) => {
    const sendInfo = {
        userName: req.body.userName,
        cbu: req.body.cbu,
        sendedAmount: req.body.amount
    };
    console.log("la info que se envio es:",sendInfo);
    let newBalance = req.session.balance - parseInt(sendInfo.sendedAmount)
    console.log("New balance y previus balance",newBalance,req.session.balance);
    
    connection.query("UPDATE `usuarios` SET `balance` = ? WHERE `cbu` = ?",[newBalance,req.session.cbu],
    async (err,results) => {
        if(err){
            console.log("ocurrio un error y fue:",err);
            return;
        }
        console.log("Los results actualizando el amount fueron:",results);
        /* Actualizado el balance de la sesión actual */
        req.session.balance = newBalance;
        console.log(req.session.balance);
    });
    connection.query("SELECT `balance` FROM `usuarios` WHERE `cbu` = ?",[sendInfo.cbu],
    (err,results) => {
        if(err){
            console.log("Error encontrando usuario:",err);
            return;
        }
        let newAmount = results[0].balance + parseInt(sendInfo.sendedAmount);
        console.log("El dinero nuevo es:",newAmount);
        connection.query("UPDATE `usuarios` SET `balance` = ? WHERE `cbu` = ?",[newAmount,sendInfo.cbu],
        (err,results) => {
            if(err){
                console.log("Ocurrio un error enviando la transferencia:",err);
                return;
            }
            console.log(results);
            res.render("transferConfirm",{
                alert:true,
                userName:"",
                fullName:"",
                cbu:"",
                actualAmount:"",
                amountToSend:""
            });
        })
    });
});

/* Destruyo la sesión actual para el logout */
app.get("/logout",(req,res) =>{
    req.session.destroy(()=>{
        res.redirect("/");
    });
});

/* Configuro el puerto por donde se va a ejecutar el servidor */
app.listen(process.env.PORT,()=>{
    console.log("Servidor funcionando");
});

/* Funcion para generar un CBU aleatorio y único */
const cbuGenerator = () => {
    let number = bcryptjs.genSaltSync();
    return number;
};