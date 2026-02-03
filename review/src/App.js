import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";

/* ========= AUTH CONTEXT ========= */

const AuthContext = createContext();

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    if (token) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
  }, [token]);

  function login(tokenData, userData) {
    localStorage.setItem("token", tokenData);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(tokenData);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ========= API HELPERS ========= */

const BASE_URL = "http://localhost:3001/api";

async function getData(endpoint, token) {
  const options = {};
  if (token) {
    options.headers = { Authorization: "Bearer " + token };
  }

  const response = await fetch(BASE_URL + endpoint, options);
  return response.json();
}

async function postData(endpoint, payload, token, isFormData = false) {
  const options = {
    method: "POST",
    headers: {},
    body: null,
  };

  if (isFormData) {
    options.body = payload;
  } else {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  if (token) {
    options.headers.Authorization = "Bearer " + token;
  }

  const response = await fetch(BASE_URL + endpoint, options);
  return response.json();
}

/* ========= LOGIN ========= */

function Login({ switchMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const auth = useAuth();

  async function handleLogin(e) {
    e.preventDefault();
    const result = await postData("/auth/login", { email, password });

    if (result.token) {
      auth.login(result.token, result.user);
    } else {
      alert("Login failed");
    }
  }

  return (
    <div className="auth">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
        <input
          type="password"
          placeholder="Password"
          onChange={e => setPassword(e.target.value)}
        />
        <button>Login</button>
      </form>
      <p onClick={switchMode}>Create account</p>
    </div>
  );
}

/* ========= REGISTER ========= */

function Register({ switchMode }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const auth = useAuth();

  async function handleRegister(e) {
    e.preventDefault();
    const result = await postData("/auth/register", { name, email, password });

    if (result.token) {
      auth.login(result.token, result.user);
    } else {
      alert("Register failed");
    }
  }

  return (
    <div className="auth">
      <h2>Register</h2>
      <form onSubmit={handleRegister}>
        <input placeholder="Name" onChange={e => setName(e.target.value)} />
        <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
        <input
          type="password"
          placeholder="Password"
          onChange={e => setPassword(e.target.value)}
        />
        <button>Register</button>
      </form>
      <p onClick={switchMode}>Already have account</p>
    </div>
  );
}

/* ========= HOME ========= */

function Home({ openBusiness }) {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    fetchBusinesses();
  }, [search, category, location]);

  async function fetchBusinesses() {
    const query = `/businesses?search=${search}&category=${category}&location=${location}`;
    const data = await getData(query);
    setList(data);
  }

  return (
    <div>
      <h2>Crowd sourced Review Platform</h2>

      <input
        placeholder="Search"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <select onChange={e => setCategory(e.target.value)}>
        <option value="">All</option>
        <option value="restaurant">Restaurant</option>
        <option value="shop">Shop</option>
        <option value="service">Service</option>
      </select>

      <input
        placeholder="Location"
        value={location}
        onChange={e => setLocation(e.target.value)}
      />

      {list.map(item => (
        <div key={item.id} className="card" onClick={() => openBusiness(item.id)}>
          <h3>{item.name}</h3>
          <p>{item.category}</p>
          <p>{item.location}</p>
          <p>Rating: {item.averageRating}</p>
        </div>
      ))}
    </div>
  );
}

/* ========= BUSINESS DETAIL ========= */

function BusinessDetail({ id, back }) {
  const auth = useAuth();
  const [info, setInfo] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState([]);

  useEffect(() => {
    loadInfo();
    loadReviews();
  }, [id]);

  async function loadInfo() {
    const data = await getData("/businesses/" + id);
    setInfo(data);
  }

  async function loadReviews() {
    const data = await getData("/businesses/" + id + "/reviews");
    setReviews(data);
  }

  async function submitReview() {
    const form = new FormData();
    form.append("comment", comment);
    form.append("quality", 5);
    form.append("service", 5);
    form.append("value", 5);

    images.forEach(file => form.append("photos", file));

    await postData("/businesses/" + id + "/reviews", form, auth.token, true);

    alert("Review sent for approval");
    setComment("");
    setImages([]);
  }

  if (!info) return <p>Loading...</p>;

  return (
    <div>
      <button onClick={back}>Back</button>

      <h2>{info.name}</h2>
      <p>{info.description}</p>
      <p>Location: {info.location}</p>
      <p>Rating: {info.averageRating}</p>

      <textarea value={comment} onChange={e => setComment(e.target.value)} />

      <input
        type="file"
        multiple
        onChange={e => setImages(Array.from(e.target.files))}
      />

      <button onClick={submitReview}>Submit Review</button>

      <h3>Reviews</h3>
      {reviews.map(r => (
        <div key={r.id}>
          <p>{r.comment}</p>
          {r.photos &&
            r.photos.map((img, i) => (
              <img key={i} src={"http://localhost:3001" + img} width="80" />
            ))}
        </div>
      ))}
    </div>
  );
}

/* ========= ADMIN ========= */

function AdminDashboard() {
  const auth = useAuth();
  const [pendingReviews, setPendingReviews] = useState([]);

  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    const data = await getData("/admin/reviews", auth.token);
    setPendingReviews(data);
  }

  async function changeStatus(id, status) {
    await postData("/admin/reviews/" + id, { status }, auth.token);
    loadPending();
  }

  return (
    <div>
      <h2>Admin Dashboard</h2>
      {pendingReviews.map(r => (
        <div key={r.id}>
          <p>{r.comment}</p>
          <button onClick={() => changeStatus(r.id, "approved")}>Approve</button>
          <button onClick={() => changeStatus(r.id, "rejected")}>Reject</button>
        </div>
      ))}
    </div>
  );
}

/* ========= MAIN APP ========= */

function App() {
  const auth = useAuth();
  const [page, setPage] = useState("home");
  const [businessId, setBusinessId] = useState(null);
  const [mode, setMode] = useState("login");

  if (!auth.user) {
    return mode === "login" ? (
      <Login switchMode={() => setMode("register")} />
    ) : (
      <Register switchMode={() => setMode("login")} />
    );
  }

  return (
    <div>
      <button onClick={() => setPage("home")}>Home</button>

      {auth.user.role === "admin" && (
        <button onClick={() => setPage("admin")}>Admin</button>
      )}

      <button onClick={auth.logout}>Logout</button>

      {page === "home" && (
        <Home
          openBusiness={id => {
            setBusinessId(id);
            setPage("detail");
          }}
        />
      )}

      {page === "detail" && (
        <BusinessDetail id={businessId} back={() => setPage("home")} />
      )}

      {page === "admin" && <AdminDashboard />}
    </div>
  );
}

/* ========= ROOT ========= */

export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
