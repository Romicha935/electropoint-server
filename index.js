const express = require('express')
const cors = require('cors')
const port = process.env.PORT || 5000
require("dotenv").config()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const app = express()
//middleware
app.use(cors({
  origin:'http://localhost:5173',
  credentials:true,
  methods:['GET','PUT','PATCH','POST','DELETE']
}))
app.use(express.json())
app.use(cookieParser())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2bkjf.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

        const userCollection = client.db("electropointDb").collection('users')
        const productCollection = client.db("electropointDb").collection("products")
        const cartCollection = client.db("electropointDb").collection("carts")
        const ordersCollection = client.db("electropointDb").collection("orders")
        const settingCollection = client.db("electropointDb").collection('settings')
        
        //jwt related api
       app.post('/jwt',async(req,res)=> {
        const user = req.body;
        // console.log(req.decoded.email, req.params.email) 
        const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
          expiresIn:'7d'
        })
        console.log(token);
        
        // document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

        res.cookie('token',token,{
          httpOnly:true,
           secure:  process.env.NODE_ENV === 'production',
          sameSite:  process.env.NODE_ENV === 'production'?  'none' : 'lax',
          maxAge:7 * 24 * 60 * 60 * 1000,
      // expires: new Date(0), // Token expiration time
    path: '/'
        })
        .send({success:true})
        // console.log("Token in Cookie: ", req.cookies.token);
  
       
       })

       const verifyToken = (req,res,next) => {
         const token = req.cookies.token;
        
         if(!token){
          return res.status(401).send({message: 'unathorized access'})
         }
         jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=> {
          if(err){
            return res.status(403).send({message: 'forbidden access'})
          }
          req.decoded = decoded;
          next()
         })
         
       }

     const verifyAdmin = async (req,res,next)=> {
        const email = req.decoded.email;
        const user =  await userCollection.findOne({email:email})
        if(user?.role !=='admin'){
          return res.status(403).send({message: 'forbidden access'})
        }
        next()
     }
    
      
        //user related api
        app.get('/users',verifyToken, async(req,res)=> {
           const result = await userCollection.find().toArray()
           res.send(result)
        })

        app.post('/users',async(req,res)=> {
          const user = req.body;
          const query = {email:user.email}
          const existingUser = await userCollection.findOne(query)

          if(existingUser){
            return res.send({message: 'user alredy exists'})
          }
          const result = await userCollection.insertOne(user)
          res.send(result)
        })

        app.get('/users/admin/:email',verifyToken, async(req,res)=> {
                 const email = req.params.email;
                 if(req.decoded.email !==email){
                 return res.status(403).send({admin:false})
                 }
                 const user = await userCollection.findOne({email:email})
                 const result = {admin: user?.role === 'admin'}
                 console.log("Decoded Email:", req.decoded.email)
                 console.log("Requested Email:", email)
                 res.send(result)
    

        })

        app.patch('/users/admin/:id',verifyToken,async(req,res)=> {
          const id = req.params.id;
          const filter = {_id: new ObjectId(id)}
          const updateDoc = {
            $set:{
              role:'admin'
            }
          }
          const result = await userCollection.updateOne(filter,updateDoc);
          res.send(result)
        })

        //logout 
        app.post('/logout', async(req,res)=> {
          res.clearCookie('token',{
            httpOnly:true,
            secure:  process.env.NODE_ENV === 'production',
            sameSite:  process.env.NODE_ENV === 'production'?  'none' : 'lax',
          }).send({message: 'logout'})
        })

        //product related api
        app.get('/products',verifyToken, async(req,res)=> {
            const result = await productCollection.find().toArray()
            res.send(result)
        })

        app.post('/products', verifyToken,verifyAdmin, async(req,res)=> {
            const item = req.body;
            const result = await productCollection.insertOne(item)
            res.send(result)
        })

        app.patch('/products/:id',async(req,res)=> {
          const product = req.body;
          const id = req.params.id;
          console.log('idd',id);
          const filter = {_id: new ObjectId(id)}

          const updateDoc = {
            $set:{
              name:product.name,
              category:product.category,
              price:product.price,
              brand:product.brand,
              rating:product.rating,
              color:product.color,
              image:product.image
            }
          }
          const result = await productCollection.updateOne(filter,updateDoc)
          res.send(result)
        })
        app.delete('/products/:id',  async(req,res)=> {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await productCollection.deleteOne(query)
            res.send(result)
        })

        //cart related api
        app.get('/carts', verifyToken, async(req,res)=> {
          const email = req.query.email;
          const result = await cartCollection.find({userEmail: email}).toArray()
          res.send(result)
        })

        app.post('/carts',verifyToken,async(req,res)=> {
          const cartItem = req.body;
          const result = await cartCollection.insertOne(cartItem)
          res.send(result)
        })

        app.delete('/carts/:id',async(req,res)=> {
           const id = req.params.id;
           const query = {_id: new ObjectId(id)}
           const result = await cartCollection.deleteOne(query)
           res.send(result)
        })

        app.delete('/carts/clear/:email',async(req,res)=> {
           const email = req.params.email;
           const result = await cartCollection.deleteMany({userEmail:email})
           res.send(result)
        })

        //admin 
        // app.get('/users/admin/:email', verifyToken, async(req,res)=>{
        //    const email = req.params.email;
        //    if(req.decoded.email !==email){
        //     return res.status(403).send({admin:false})
        //    }
        //    const user = await userCollection.findOne({email:email})
        //    const result = {admin: user?.role === 'admin'}
        //    res.send(result)
        //})
      
        //order related api
        app.get('/orders', verifyToken, async(req,res)=> {
          const result = await ordersCollection.find().toArray()
          res.send(result)
        })

        app.post('/orders', async(req,res)=> {
          const order = req.body;
          const result = await ordersCollection.insertOne(order)
          res.send(result)
        })

        app.delete('/orders/:id', async(req,res)=> {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) }
          const result = await ordersCollection.deleteOne(query)
          res.send(result)
        })
        

        // app.delete('/orders/:orderId/item/:itemId', async (req,res)=> {
        //   const {orderId,itemId} = req.params;
        //   try {
        //     const orderObjectId = new ObjectId(orderId); // orderId কে ObjectId তে কনভার্ট করা হচ্ছে
        //     const itemObjectId = new ObjectId(itemId);   // itemId কে ObjectId তে কনভার্ট করা হচ্ছে
          
        //     const result = await ordersCollection.updateOne(
        //       { _id: orderObjectId }, // orderId ব্যবহার
        //       { $pull: { items: { _id: itemObjectId } } } // itemId ব্যবহার
        //     );
          
        //     res.send(result);
        //   } catch (error) {
        //     res.status(400).send({ message: "Invalid ObjectId format", error: error.message });
        //   }
          
        // })

        //setting related api
        app.get('/settings', verifyToken, async(req,res)=> {
          const result = await settingCollection.findOne({})
          res.send(result)
        })
        app.post('/settings',verifyToken,async(req,res)=> {
          const settingsData =req.body;
          const filter = {};
          const options = {upsert: true};
          const updateDoc = {$set:settingsData}
          const result = await settingCollection.updateOne(filter,updateDoc,options);
          res.send({messagee:'setting save or updated',result})
        })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=> {
   res.send('electropoint is running')
})

app.listen(port,()=> {
    console.log(`electropoint is the runing port on ${port}`);
    
})